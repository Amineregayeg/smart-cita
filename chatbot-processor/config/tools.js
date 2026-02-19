/**
 * OpenAI Function/Tool Definitions for LaserOstop Chatbot
 * These tools enable the chatbot to check availability and create bookings
 * AASP Security Layer integrated for audit logging and payment protection
 */

const { logBookingStats } = require('../lib/redis-client');
const aasp = require('../lib/aasp-security');

const CHATBOT_TOOLS = [
  {
    type: "function",
    function: {
      name: "check_availability",
      description: "Consultar disponibilidad de citas en un centro LaserOstop. Usar cuando el usuario pregunte por horarios disponibles o quiera reservar una cita.",
      parameters: {
        type: "object",
        properties: {
          center: {
            type: "string",
            enum: ["barcelona", "sevilla", "chamartin", "atocha"],
            description: "Centro donde consultar disponibilidad. barcelona=Barcelona Sants, chamartin=Madrid Chamartín, atocha=Madrid Atocha, sevilla=Sevilla"
          },
          treatment: {
            type: "string",
            enum: ["tabaco", "duo", "cannabis", "azucar"],
            description: "Tipo de tratamiento. tabaco=dejar de fumar individual (190€), duo=dejar de fumar en pareja (360€ total), cannabis=adicción al cannabis (250€), azucar=adicción al azúcar (200€). Por defecto usar 'tabaco' si no se especifica."
          },
          days_ahead: {
            type: "number",
            description: "Número de días a consultar hacia adelante. Por defecto 14 días."
          }
        },
        required: ["center"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_booking",
      description: "Crear una reserva de cita. IMPORTANTE: Solo llamar después de que el usuario haya CONFIRMADO explícitamente todos los datos (centro, fecha, hora, nombre, email, teléfono). Nunca crear reserva sin confirmación.",
      parameters: {
        type: "object",
        properties: {
          center: {
            type: "string",
            enum: ["barcelona", "sevilla", "chamartin", "atocha"],
            description: "Centro donde reservar"
          },
          treatment: {
            type: "string",
            enum: ["tabaco", "duo", "cannabis", "azucar"],
            description: "Tipo de tratamiento"
          },
          date: {
            type: "string",
            description: "Fecha de la cita en formato YYYY-MM-DD (ej: 2025-12-27)"
          },
          time: {
            type: "string",
            description: "Hora de la cita en formato HH:MM (ej: 10:00, 14:30)"
          },
          full_name: {
            type: "string",
            description: "Nombre completo del cliente"
          },
          email: {
            type: "string",
            description: "Email del cliente (debe contener @ y .)"
          },
          phone: {
            type: "string",
            description: "Teléfono del cliente (mínimo 9 dígitos)"
          }
        },
        required: ["center", "treatment", "date", "time", "full_name", "email", "phone"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_center_info",
      description: "Obtener información sobre los centros LaserOstop (direcciones, teléfonos, ubicaciones). Usar cuando el usuario pregunte dónde están los centros o necesite información de contacto.",
      parameters: {
        type: "object",
        properties: {
          center: {
            type: "string",
            enum: ["barcelona", "sevilla", "chamartin", "atocha", "all"],
            description: "Centro específico o 'all' para ver todos los centros"
          }
        },
        required: ["center"]
      }
    }
  },
  // Payment tool - ready for Stripe integration
  {
    type: "function",
    function: {
      name: "process_payment",
      description: "Procesar un pago por Stripe. Genera un enlace de pago para el cliente. SOLO usar cuando el cliente confirme que quiere pagar online.",
      parameters: {
        type: "object",
        properties: {
          amount: {
            type: "number",
            description: "Cantidad a cobrar en céntimos (ej: 19000 para 190€)"
          },
          currency: {
            type: "string",
            enum: ["EUR"],
            description: "Moneda del pago"
          },
          description: {
            type: "string",
            description: "Descripción del pago (ej: 'Tratamiento Tabaco - Barcelona')"
          },
          customer_email: {
            type: "string",
            description: "Email del cliente para enviar el enlace"
          },
          booking_id: {
            type: "string",
            description: "ID de la reserva asociada (opcional)"
          }
        },
        required: ["amount", "description", "customer_email"]
      }
    }
  }
];

// Treatment prices in cents
const TREATMENT_PRICES = {
  tabaco: 19000,    // 190€
  duo: 36000,       // 360€
  cannabis: 25000,  // 250€
  azucar: 20000     // 200€
};

/**
 * Tool execution handler with AASP security integration
 * Executes the appropriate function based on tool call
 */
async function executeToolCall(toolName, args, smartAgendaService, platform = 'unknown') {
  console.log(`[TOOLS] Executing: ${toolName}`, args);

  // Log all tool calls to AASP for audit (non-blocking)
  logToolCallToAASP(toolName, args).catch(err => {
    console.warn('[AASP] Audit log failed:', err.message);
  });

  switch (toolName) {
    case 'check_availability':
      return await smartAgendaService.checkAvailability(
        args.center,
        args.treatment || 'tabaco',
        args.days_ahead || 14
      );

    case 'create_booking':
      const result = await smartAgendaService.createBooking(args);

      // Log booking stats if successful
      if (result.success) {
        await logBookingStats({
          center: args.center,
          treatment: args.treatment,
          date: args.date,
          time: args.time,
          eventId: result.appointmentId,
          platform: platform
        });
      }

      return result;

    case 'get_center_info':
      return smartAgendaService.getCenterInfo(args.center);

    case 'process_payment':
      return await executePaymentWithSecurity(args);

    default:
      return {
        success: false,
        error: 'unknown_tool',
        message: `Herramienta desconocida: ${toolName}`
      };
  }
}

/**
 * Log tool calls to AASP for audit purposes
 */
async function logToolCallToAASP(toolName, args) {
  try {
    await aasp.evaluateAction('tool_call', toolName, args);
  } catch (error) {
    // Non-blocking - just log
    console.warn('[AASP] Audit failed for', toolName);
  }
}

/**
 * Execute payment with AASP security check
 * This is where payment protection happens
 */
async function executePaymentWithSecurity(args) {
  const { amount, currency = 'EUR', description, customer_email, booking_id } = args;

  console.log(`[PAYMENT] Processing payment: ${amount} cents (${amount/100}€)`);

  // AASP Security Check
  const securityCheck = await aasp.securePaymentCheck(amount, currency, {
    description: description,
    customer_email: customer_email,
    booking_id: booking_id
  });

  if (securityCheck.blocked) {
    console.log(`[PAYMENT] BLOCKED by AASP: ${securityCheck.reason}`);
    return {
      success: false,
      error: 'payment_blocked',
      message: 'Este pago supera el límite permitido. Por favor, contacta con nosotros por WhatsApp: +34 689 560 130',
      reason: securityCheck.reason
    };
  }

  if (securityCheck.requiresApproval) {
    console.log(`[PAYMENT] REQUIRES APPROVAL: ${securityCheck.reason}`);
    return {
      success: false,
      error: 'payment_pending_approval',
      message: 'Este pago requiere aprobación. Un agente te contactará en breve para completar el proceso.',
      approvalId: securityCheck.approvalId,
      reason: securityCheck.reason
    };
  }

  // Payment allowed - proceed with Stripe
  console.log(`[PAYMENT] ALLOWED by AASP - proceeding with Stripe`);

  // TODO: Integrate Stripe payment link creation here
  // For now, return a placeholder response
  return {
    success: true,
    message: `Pago de ${amount/100}€ preparado. Enlace de pago: [Stripe integration pending]`,
    amount: amount,
    currency: currency,
    description: description,
    // payment_link: stripePaymentLink // Will be added with Stripe integration
  };
}

module.exports = {
  CHATBOT_TOOLS,
  executeToolCall,
  TREATMENT_PRICES
};
