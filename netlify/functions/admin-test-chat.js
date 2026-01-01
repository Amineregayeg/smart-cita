/**
 * Admin Chat Tester Endpoint
 * POST /api/admin-test-chat
 *
 * Allows admins to test the chatbot with full tool calling support (availability + booking)
 */

const { validateAdminSession } = require('./shared/redis-client');
const crypto = require('crypto');

// Google Sheets Configuration
const GOOGLE_SHEETS_ID = process.env.GOOGLE_SHEETS_ID || '1YDSzRMcY6bJPe2hbIdZ5xvQpIJDxEla0tYBM2KQYZ3Q';
const SHEET_TABS = {
  general: 'General',
  barcelona: 'Barcelona',
  sevilla: 'Sevilla',
  chamartin: 'Chamartin',
  atocha: 'Atocha',
  torrejon: 'Torrejon',
  majadahonda: 'Majadahonda'
};

/**
 * Generate JWT for Google API authentication
 */
async function getGoogleAccessToken() {
  const credentials = JSON.parse(process.env.GOOGLE_SHEETS_CREDENTIALS || '{}');
  if (!credentials.private_key || !credentials.client_email) {
    throw new Error('Google Sheets credentials not configured');
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: credentials.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  };

  const base64Header = Buffer.from(JSON.stringify(header)).toString('base64url');
  const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signatureInput = `${base64Header}.${base64Payload}`;

  const sign = crypto.createSign('RSA-SHA256');
  sign.update(signatureInput);
  const signature = sign.sign(credentials.private_key, 'base64url');

  const jwt = `${signatureInput}.${signature}`;

  // Exchange JWT for access token
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  });

  if (!tokenResponse.ok) {
    const error = await tokenResponse.text();
    throw new Error(`Failed to get Google access token: ${error}`);
  }

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

/**
 * Append a row to a Google Sheet tab
 */
async function appendToGoogleSheet(tabName, rowData) {
  try {
    const accessToken = await getGoogleAccessToken();
    const range = `${tabName}!A:G`;

    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEETS_ID}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          values: [rowData]
        })
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('[GOOGLE SHEETS] Append failed:', error);
      return { success: false, error };
    }

    const result = await response.json();
    console.log('[GOOGLE SHEETS] Row appended to', tabName);
    return { success: true, updates: result.updates };
  } catch (error) {
    console.error('[GOOGLE SHEETS] Error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Strip markdown formatting from text for plain display
 * @param {string} text - Text potentially containing markdown
 * @returns {string} - Clean text without markdown symbols
 */
function stripMarkdown(text) {
  if (!text) return text;

  return text
    // Remove bold **text** or __text__
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    // Remove italic *text* or _text_ (but not single _ in words)
    .replace(/\*([^*\n]+)\*/g, '$1')
    // Remove headers # ## ###
    .replace(/^#{1,6}\s+/gm, '')
    // Remove bullet points - and * at start of lines, keep content
    .replace(/^[\s]*[-*]\s+/gm, '')
    // Remove numbered list formatting but keep numbers
    .replace(/^(\d+)\.\s+/gm, '$1. ')
    // Remove code blocks ```
    .replace(/```[\s\S]*?```/g, '')
    // Remove inline code `text`
    .replace(/`([^`]+)`/g, '$1')
    // Remove blockquotes >
    .replace(/^>\s+/gm, '')
    // Clean up extra whitespace
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Calculate dates for system prompt
const today = new Date();
const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
const daysUntilMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek);
const nextMonday = new Date(today);
nextMonday.setDate(today.getDate() + daysUntilMonday);

// System prompt with booking capabilities
const SYSTEM_PROMPT = `Eres el asistente virtual de LaserOstop España, especialista en tratamientos láser para dejar adicciones.

## IDENTIDAD
- Nombre: Asistente LaserOstop
- Rol: Community Manager / Atención al cliente
- Idioma: SOLO español de España
- Tono: Profesional, cercano y empático
- Fecha de HOY: ${today.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
- Próximo lunes: ${nextMonday.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}

## INTERPRETACIÓN DE FECHAS - MUY IMPORTANTE
- "esta semana" = desde hoy (${today.getDate()} dic) hasta el domingo
- "próxima semana" o "next week" = desde el próximo lunes (${nextMonday.getDate()} dic) en adelante
- NUNCA incluir fechas anteriores al próximo lunes cuando el usuario pide "próxima semana"
- Si hoy es ${today.toLocaleDateString('es-ES', { weekday: 'long' })}, la próxima semana empieza el lunes ${nextMonday.getDate()}

## HERRAMIENTAS DISPONIBLES (OBLIGATORIO USARLAS)

Tienes acceso a estas herramientas que DEBES usar:
1. check_availability - Para consultar horarios disponibles
2. create_booking - Para crear reservas (OBLIGATORIO para confirmar citas)
3. get_center_info - Para información de centros
4. log_callback - Para registrar solicitudes de llamada cuando no puedes responder algo

## REGLA CRÍTICA - DISPONIBILIDAD

- SOLO muestra los horarios EXACTOS que devuelve check_availability
- Si check_availability devuelve slots: [] (vacío), DEBES decir "No hay disponibilidad en este momento"
- NUNCA inventes horarios que no aparecen en la respuesta de la herramienta
- Si no hay slots, recomienda otro centro o contactar por WhatsApp: +34 689 560 130
- Los horarios mostrados DEBEN corresponder exactamente a los de la respuesta de check_availability

## REGLA CRÍTICA - CREAR RESERVAS

NUNCA digas que una reserva está confirmada sin haber llamado a create_booking
DEBES llamar a create_booking con TODOS los parámetros para crear una reserva real
Solo puedes confirmar una reserva cuando create_booking devuelve success: true
SIEMPRE incluye el número de reserva (appointmentId) en la confirmación
Si create_booking devuelve un error, DEBES informar al usuario del problema

Parámetros OBLIGATORIOS para create_booking:
- center: código del centro (barcelona, sevilla, chamartin, atocha, torrejon, majadahonda)
- treatment: tipo (tabaco, duo, cannabis, azucar)
- date: fecha en formato YYYY-MM-DD
- time: hora en formato HH:MM
- full_name: nombre completo del cliente
- email: correo electrónico
- phone: teléfono (mínimo 9 dígitos)

## CENTROS Y CÓDIGOS
- Barcelona Sants → código: "barcelona"
- Sevilla → código: "sevilla"
- Madrid Chamartín → código: "chamartin"
- Madrid Atocha → código: "atocha"
- Majadahonda → código: "majadahonda"
- Torrejón de Ardoz → código: "torrejon"

## TRATAMIENTOS, PRECIOS Y SESIONES
- Tabaco (individual): 190€ - 1 sesión de 60 min
- Duo (2 personas): 360€ total - 1 sesión de 90 min
- Cannabis: 250€ - 2 sesiones de 60 min
- Azúcar: 200€ - 4 sesiones de 60 min

## EFECTOS SECUNDARIOS - MUY IMPORTANTE
- El tratamiento NO tiene efectos secundarios
- NUNCA menciones efectos secundarios, náuseas, mareos, irritabilidad, etc.
- Si preguntan: "No hay efectos secundarios. El tratamiento es completamente seguro."
- Excepciones SOLO si el cliente pregunta expresamente: contraindicado con marcapasos
- Los síntomas de desintoxicación del THC se explican en la consulta presencial, NO por chatbot

## PACIENTES CON CÁNCER
- Podemos ayudar a pacientes con cáncer a dejar de fumar
- NO es necesario que consulten con su médico antes
- No menciones que deben hablar con su oncólogo o médico

## RECAÍDAS (SESIONES DE REFUERZO)
- Las sesiones de recaída/refuerzo las gestiona el equipo directamente
- Si el cliente pregunta por recaída, indicar: "Para sesiones de refuerzo, contacta por WhatsApp: +34 689 560 130"
- NO ofrezcas reservar recaídas por este chat

## PREGUNTAS QUE NO PUEDES RESPONDER - MUY IMPORTANTE

Cuando el usuario haga preguntas que NO puedes responder (preguntas médicas específicas, detalles técnicos del tratamiento, casos especiales, etc.):

1. NO digas "No lo sé" ni inventes información
2. En su lugar, di: "Esta consulta requiere hablar con nuestro equipo. ¿Me dejas tu número de teléfono para que te llamen?"
3. Cuando el usuario proporcione su teléfono, DEBES usar la herramienta log_callback con:
   - phone: el número que dio
   - question: la pregunta específica que no pudiste responder
   - name, email: si los proporcionó
   - center: si mencionó un centro específico
   - treatment: si mencionó un tratamiento específico
4. Después de log_callback, confirma: "Perfecto, un agente de LaserOstop te llamará lo antes posible al [número]"

Ejemplos de preguntas que requieren callback:
- "¿Qué pasa si tomo medicación X?"
- "¿Funciona si tengo X enfermedad?"
- "¿Cuántas sesiones necesitaré exactamente?"
- "¿Puedo combinar con otro tratamiento?"
- Cualquier pregunta médica específica que no esté en tus datos

## CALLBACK - CUANDO DEJAN SU NÚMERO
Si el cliente proporciona su teléfono sin completar una reserva:
- USA log_callback para registrar la solicitud
- Confirma: "Perfecto, un agente de LaserOstop te llamará lo antes posible al [número]"

## SITIO WEB
- NO redirijas a ningún sitio web
- Para más información, ofrece siempre WhatsApp: +34 689 560 130

## FLUJO DE RESERVA - MUY IMPORTANTE

1. Usuario pide cita → Pregunta centro y tratamiento si no los dice
2. Usa check_availability para obtener horarios REALES
3. Usuario elige horario → Pide nombre, email y teléfono
4. Cuando tengas TODOS los datos → Muestra resumen y pregunta: "¿Confirmo la reserva?"
5. ESPERA a que el usuario diga "sí", "confirmo", "ok" o similar
6. SOLO cuando el usuario confirme explícitamente → Llama a create_booking
7. Si create_booking devuelve success → Confirma con el número de reserva

⚠️ CRÍTICO: NO llames a create_booking hasta que el usuario confirme explícitamente.
Después de recibir los datos (nombre, email, teléfono), SOLO muestra el resumen y pregunta si confirma.
NO crees la reserva automáticamente al recibir los datos.
8. Si create_booking falla → Informa del error y ofrece WhatsApp: +34 689 560 130

## REGLA CRÍTICA DE CONFIRMACIÓN

NUNCA digas "confirmado", "reservado", "listo" o similar SIN haber llamado a create_booking primero.
Cuando el usuario diga "sí", "ok", "confirmo", "adelante" después de ver el resumen:
- DEBES llamar a create_booking INMEDIATAMENTE en esa misma respuesta
- NO pidas más confirmaciones adicionales
- Si create_booking devuelve success: true, ENTONCES puedes decir que está confirmado
- Si no llamaste a create_booking, NO está confirmado aunque el usuario haya dicho "sí"

## PAGO ONLINE - DESPUÉS DE CONFIRMAR RESERVA

Cuando create_booking devuelve success: true con paymentLinks, DEBES incluir las opciones de pago:

Formato de confirmación con pago:
"Tu reserva ha sido confirmada. Número de reserva: [appointmentId]

Centro: [center]
Tratamiento: [treatment]
Fecha: [displayDate]
Hora: [time]

💳 Opciones de pago online:
Pago único ([precio onetime]€): [url onetime]
Pago en 3 cuotas (3x[precio monthly]€): [url monthly]

También puedes pagar en el centro el día de tu cita. ¡Te esperamos!"

IMPORTANTE: Usa los enlaces EXACTOS de paymentLinks. NO inventes enlaces de pago.

## FORMATO DE RESPUESTAS - MUY IMPORTANTE
- NUNCA uses formato markdown (**, *, #, -, etc.)
- Escribe en texto plano sin símbolos de formato
- Para listas de horarios, muestra cada día en una NUEVA LÍNEA separada
- Máximo 2-3 párrafos cortos
- Un emoji máximo por mensaje
- Ejemplo de formato de horarios:
  📅 Disponibilidad:
  Lunes 30 dic: 10:00, 11:00, 12:00
  Martes 31 dic: 10:00, 11:00
- NO uses asteriscos, guiones ni otros símbolos de formato

Responde de forma natural, como un asesor real de LaserOstop.`;

// Tool definitions
const CHATBOT_TOOLS = [
  {
    type: "function",
    function: {
      name: "check_availability",
      description: "Consultar disponibilidad de citas en un centro LaserOstop. Siempre consulta 14 días hacia adelante.",
      parameters: {
        type: "object",
        properties: {
          center: {
            type: "string",
            enum: ["barcelona", "sevilla", "chamartin", "atocha", "torrejon", "majadahonda"],
            description: "Centro donde consultar disponibilidad"
          },
          treatment: {
            type: "string",
            enum: ["tabaco", "duo", "cannabis", "azucar"],
            description: "Tipo de tratamiento"
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
      description: "OBLIGATORIO: Debes llamar a esta función para confirmar cualquier reserva. Sin llamar a esta función, la reserva NO se crea. Llama cuando el usuario confirme con 'sí', 'confirmo', 'ok', 'adelante', etc.",
      parameters: {
        type: "object",
        properties: {
          center: {
            type: "string",
            enum: ["barcelona", "sevilla", "chamartin", "atocha", "torrejon", "majadahonda"],
            description: "Código del centro: barcelona, sevilla, chamartin, atocha, torrejon, majadahonda"
          },
          treatment: {
            type: "string",
            enum: ["tabaco", "duo", "cannabis", "azucar"],
            description: "Tipo de tratamiento"
          },
          date: { type: "string", description: "Fecha en formato YYYY-MM-DD (ej: 2025-12-23)" },
          time: { type: "string", description: "Hora en formato HH:MM (ej: 15:00)" },
          full_name: { type: "string", description: "Nombre completo del cliente" },
          email: { type: "string", description: "Email del cliente" },
          phone: { type: "string", description: "Teléfono del cliente (mínimo 9 dígitos)" }
        },
        required: ["center", "treatment", "date", "time", "full_name", "email", "phone"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_center_info",
      description: "Obtener información sobre los centros LaserOstop.",
      parameters: {
        type: "object",
        properties: {
          center: {
            type: "string",
            enum: ["barcelona", "sevilla", "chamartin", "atocha", "torrejon", "majadahonda", "all"]
          }
        },
        required: ["center"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "log_callback",
      description: "Registrar solicitud de callback cuando el usuario proporciona su teléfono para que le llamen. Usar cuando: 1) El usuario hace preguntas que no puedes responder y acepta dejar su teléfono, 2) El usuario pide que le llamen, 3) El usuario prefiere hablar con una persona.",
      parameters: {
        type: "object",
        properties: {
          phone: {
            type: "string",
            description: "Número de teléfono del usuario"
          },
          name: {
            type: "string",
            description: "Nombre del usuario (si lo proporcionó)"
          },
          email: {
            type: "string",
            description: "Email del usuario (si lo proporcionó)"
          },
          question: {
            type: "string",
            description: "La pregunta o consulta específica del usuario que no pudiste responder"
          },
          center: {
            type: "string",
            enum: ["barcelona", "sevilla", "chamartin", "atocha", "torrejon", "majadahonda", ""],
            description: "Centro específico si el usuario mencionó alguno, vacío si no"
          },
          treatment: {
            type: "string",
            enum: ["tabaco", "duo", "cannabis", "azucar", ""],
            description: "Tratamiento mencionado si aplica, vacío si no"
          }
        },
        required: ["phone", "question"]
      }
    }
  }
];

// Center mapping for Smart Agenda API
const CENTERS = {
  'barcelona': { agendaId: '43', name: 'Barcelona Sants', groupId: '4' },
  'sevilla': { agendaId: '44', name: 'Sevilla', groupId: '5' },
  'chamartin': { agendaId: '48', name: 'Madrid Chamartín', groupId: '7' },
  'torrejon': { agendaId: '49', name: 'Torrejón de Ardoz', groupId: '6' },
  'atocha': { agendaId: '50', name: 'Madrid Atocha', groupId: '8' },
  'majadahonda': { agendaId: '51', name: 'Majadahonda', groupId: '10' }
};

const APPOINTMENT_TYPES = {
  '43': { 'tabaco': '20', 'duo': '21', 'cannabis': '23', 'recaida': '22', 'azucar': '91' },
  '44': { 'tabaco': '32', 'duo': '34', 'cannabis': '37', 'recaida': '35', 'azucar': '96' },
  '48': { 'tabaco': '44', 'duo': '46', 'cannabis': '49', 'recaida': '47', 'azucar': '93' },
  '49': { 'tabaco': '53', 'duo': '56', 'cannabis': '59', 'recaida': '57', 'azucar': '97' },
  '50': { 'tabaco': '63', 'duo': '65', 'cannabis': '68', 'recaida': '66', 'azucar': '92' },
  '51': { 'tabaco': '72', 'duo': '74', 'cannabis': '77', 'recaida': '75', 'azucar': '94' }
};

const TREATMENTS = {
  'tabaco': { name: 'Dejar de fumar (individual)', duration: 60, price: 190, sessions: 1 },
  'duo': { name: 'Dejar de fumar (dúo)', duration: 90, price: 360, sessions: 1 },
  'cannabis': { name: 'Adicción al cannabis', duration: 60, price: 250, sessions: 2 },
  'azucar': { name: 'Adicción al azúcar', duration: 60, price: 200, sessions: 4 }
};

const CENTER_DETAILS = {
  'barcelona': { name: 'LaserOstop Barcelona Sants', address: 'Carrer de Galileu, 65, Sants-Montjuïc, 08028 Barcelona', phone: '+34 689 560 130', hours: 'Martes a Sábado: 11:00 - 20:00' },
  'sevilla': { name: 'LaserOstop Sevilla', address: 'Avenida Eduardo Dato 85, 41005 Sevilla', phone: '+34 689 560 130', hours: 'Lunes a Viernes: 9:00-13:00 y 14:00-18:00, Sábado: 10:00-14:00' },
  'chamartin': { name: 'LaserOstop Madrid Chamartín', address: 'Calle de Oruro, 9, Chamartín, 28016 Madrid', phone: '+34 919 305 313', hours: 'Martes a Sábado: 11:00 - 20:00' },
  'atocha': { name: 'LaserOstop Madrid Atocha', address: 'Calle Canarias 26, Atocha, 28045 Madrid', phone: '+34 613 255 948', hours: 'Martes a Sábado: 11:00 - 20:00' },
  'torrejon': { name: 'LaserOstop Torrejón de Ardoz', address: 'Calle Pesquera, 10, 28850 Torrejón de Ardoz', phone: '+34 919 305 313', hours: 'Martes a Sábado: 11:00 - 20:00' },
  'majadahonda': { name: 'LaserOstop Majadahonda', address: 'Calle del Dr Calero, 19, Centro comercial Tutti, 28220 Majadahonda', phone: '+34 919 305 313', hours: 'Martes a Sábado: 11:00 - 20:00' }
};

// Stripe Payment Links by Company (BF Links - Current Active)
// Company 1: Chamartín (48), Torrejón (49), Majadahonda (51)
// Company 2: Barcelona (43), Sevilla (44), Atocha (50)
const STRIPE_PAYMENT_LINKS = {
  company1: {
    centers: ['48', '49', '51'],
    treatments: {
      tabaco: {
        onetime: { url: 'https://buy.stripe.com/14A3cueQn8oee5L36dawo0q', price: 170 },
        monthly: { url: 'https://buy.stripe.com/dRm6oGbEb1ZQ8LreOVawo0f', price: 60, installments: 3 }
      },
      duo: {
        onetime: { url: 'https://buy.stripe.com/bJeaEW0ZxbAqd1H229awo0r', price: 340 },
        monthly: { url: 'https://buy.stripe.com/9B64gyeQn7kabXD9uBawo07', price: 120, installments: 3 }
      },
      cannabis: {
        onetime: { url: 'https://buy.stripe.com/7sY14m8rZ47Y7Hn5elawo0s', price: 230 },
        monthly: { url: 'https://buy.stripe.com/14A28q4bJ47Y7HneOVawo0t', price: 85, installments: 3 }
      },
      azucar: {
        onetime: { url: 'https://buy.stripe.com/4gM5kCaA7dIyaTz9uBawo09', price: 180 },
        monthly: { url: 'https://buy.stripe.com/eVq6oGeQncEu6Dj9uBawo0u', price: 67, installments: 3 }
      }
    }
  },
  company2: {
    centers: ['43', '44', '50'],
    treatments: {
      tabaco: {
        onetime: { url: 'https://buy.stripe.com/9B65kD709csd2BZcV2dby0y', price: 170 },
        monthly: { url: 'https://buy.stripe.com/dRm9ATckt4ZLdgDf3adby0n', price: 60, installments: 3 }
      },
      duo: {
        onetime: { url: 'https://buy.stripe.com/8x26oH7093VHa4r9IQdby0z', price: 340 },
        monthly: { url: 'https://buy.stripe.com/7sYcN5dox3VH1xV08gdby0f', price: 120, installments: 3 }
      },
      cannabis: {
        onetime: { url: 'https://buy.stripe.com/9B67sL2JT3VHa4raMUdby0A', price: 230 },
        monthly: { url: 'https://buy.stripe.com/7sY5kDgAJak52BZ6wEdby0B', price: 85, installments: 3 }
      },
      azucar: {
        onetime: { url: 'https://buy.stripe.com/5kQ14n7090Jv3G39IQdby0h', price: 180 },
        monthly: { url: 'https://buy.stripe.com/8x24gzacldwhdgD2godby0C', price: 67, installments: 3 }
      }
    }
  }
};

/**
 * Get Stripe payment links for a center and treatment
 * @param {string} agendaId - The agenda ID of the center
 * @param {string} treatment - The treatment type (tabaco, duo, cannabis, azucar)
 * @returns {object|null} - Payment links object or null if not found
 */
function getPaymentLinks(agendaId, treatment) {
  const company = STRIPE_PAYMENT_LINKS.company1.centers.includes(agendaId)
    ? STRIPE_PAYMENT_LINKS.company1
    : STRIPE_PAYMENT_LINKS.company2;

  const treatmentLinks = company.treatments[treatment.toLowerCase()];
  if (!treatmentLinks) return null;

  return {
    onetime: treatmentLinks.onetime,
    monthly: treatmentLinks.monthly
  };
}

// Token cache for Smart Agenda
let tokenCache = { token: null, expiry: null };

/**
 * Harbyx AASP Integration - AI Action Security Protocol
 * Logs chatbot actions for monitoring and security auditing
 * Free tier: 1,000 actions/month
 */
const HARBYX_CONFIG = {
  enabled: !!process.env.HARBYX_API_KEY,
  apiKey: process.env.HARBYX_API_KEY,
  agentId: process.env.HARBYX_AGENT_ID || 'laserostop-chatbot',
  endpoint: 'https://api.harbyx.com/v1/actions'
};

/**
 * Log an action to Harbyx AASP (non-blocking)
 */
function logToHarbyx(actionType, params, result, metadata = {}) {
  if (!HARBYX_CONFIG.enabled) return;

  const payload = {
    agent_id: HARBYX_CONFIG.agentId,
    action_type: actionType,
    timestamp: new Date().toISOString(),
    parameters: params,
    result: {
      success: result?.success ?? true,
      data: result?.success ? {
        appointmentId: result.appointmentId,
        center: result.center,
        slotsFound: result.slots?.length
      } : { error: result?.error, message: result?.message }
    },
    metadata: { environment: process.env.NODE_ENV || 'production', ...metadata }
  };

  // Fire and forget - don't block responses
  fetch(HARBYX_CONFIG.endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${HARBYX_CONFIG.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  }).then(() => {
    console.log(`[HARBYX] Logged: ${actionType}`);
  }).catch(err => {
    console.error('[HARBYX] Failed:', err.message);
  });
}

async function getSmartAgendaToken() {
  if (tokenCache.token && tokenCache.expiry && Date.now() < tokenCache.expiry - 300000) {
    return tokenCache.token;
  }

  const baseUrl = process.env.SMART_AGENDA_BASE_URL || 'https://www.smartagenda.fr/pro/laserostop-esh/api';
  const response = await fetch(`${baseUrl}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      login: process.env.SMART_AGENDA_LOGIN,
      pwd: process.env.SMART_AGENDA_PWD,
      api_id: process.env.SMART_AGENDA_API_ID,
      api_key: process.env.SMART_AGENDA_API_KEY
    })
  });

  if (!response.ok) throw new Error(`Token request failed: ${response.status}`);
  const data = await response.json();
  tokenCache = { token: data.token, expiry: Date.now() + (2 * 60 * 60 * 1000) };
  return data.token;
}

async function smartAgendaRequest(endpoint, options = {}) {
  const token = await getSmartAgendaToken();
  const baseUrl = process.env.SMART_AGENDA_BASE_URL || 'https://www.smartagenda.fr/pro/laserostop-esh/api';

  console.log(`[ADMIN-TEST-CHAT] Smart Agenda request: ${options.method || 'GET'} ${endpoint}`);

  const response = await fetch(`${baseUrl}${endpoint}`, {
    ...options,
    headers: {
      'X-SMARTAPI-TOKEN': token,
      'Content-Type': 'application/json',
      ...options.headers
    }
  });

  console.log(`[ADMIN-TEST-CHAT] Smart Agenda response: ${response.status}`);

  return response;
}

function formatSpanishDate(dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
}

/**
 * Filter slots to show max 3 days with 3 spaced-out times per day
 * Selects morning (9-11), midday (12-14), afternoon (15-18) when possible
 */
function filterOptimalSlots(slots, maxDays = 3, slotsPerDay = 3) {
  // Take first maxDays days that have availability
  const limitedDays = slots.slice(0, maxDays);

  return limitedDays.map(day => {
    // CRITICAL: Filter to only full hours (:00) to prevent overlapping with 1-hour sessions
    const fullHourTimes = day.times.filter(t => t.endsWith(':00'));

    if (fullHourTimes.length === 0) {
      // If no full hours, skip this day
      return null;
    }

    if (fullHourTimes.length <= slotsPerDay) {
      return { ...day, times: fullHourTimes, timesFormatted: fullHourTimes.join(', ') };
    }

    // Select spaced slots: morning (9-11), midday (12-14), afternoon (15-19)
    const morning = fullHourTimes.find(t => t >= '09:00' && t <= '11:00');
    const midday = fullHourTimes.find(t => t >= '12:00' && t <= '14:00');
    const afternoon = fullHourTimes.find(t => t >= '15:00' && t <= '19:00');

    const selected = [morning, midday, afternoon].filter(Boolean);

    // If we have 3 spaced slots, use them
    if (selected.length >= slotsPerDay) {
      return { ...day, times: selected.slice(0, slotsPerDay), timesFormatted: selected.slice(0, slotsPerDay).join(', ') };
    }

    // Otherwise, distribute evenly across available full-hour times
    const step = Math.max(1, Math.floor(fullHourTimes.length / slotsPerDay));
    const distributed = [];
    for (let i = 0; i < slotsPerDay && i * step < fullHourTimes.length; i++) {
      distributed.push(fullHourTimes[i * step]);
    }
    return { ...day, times: distributed, timesFormatted: distributed.join(', ') };
  }).filter(Boolean); // Remove null days (days with no full-hour slots)
}

async function executeToolCall(toolName, args) {
  console.log(`[ADMIN-TEST-CHAT] Executing tool: ${toolName}`, args);

  switch (toolName) {
    case 'check_availability': {
      const center = CENTERS[args.center?.toLowerCase()];
      if (!center) {
        return { success: false, error: 'invalid_center', message: `Centro no válido: ${args.center}` };
      }

      const treatment = args.treatment || 'tabaco';
      const typeId = APPOINTMENT_TYPES[center.agendaId]?.[treatment];
      if (!typeId) {
        return { success: false, error: 'invalid_treatment', message: `Tratamiento no válido: ${treatment}` };
      }

      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 14);  // Always check 14 days ahead

      try {
        const requestBody = {
          pdo_type_rdv_id: typeId,
          pdo_agenda_id: center.agendaId,
          date_a_partir_de: startDate.toISOString().split('T')[0],
          date_fin: endDate.toISOString().split('T')[0]
        };
        console.log('[ADMIN-TEST-CHAT] Availability request:', JSON.stringify(requestBody));

        const response = await smartAgendaRequest('/service/getAvailabilities', {
          method: 'POST',
          body: JSON.stringify(requestBody)
        });

        console.log('[ADMIN-TEST-CHAT] Availability response status:', response.status);

        if (response.status === 404) {
          console.log('[ADMIN-TEST-CHAT] NO SLOTS AVAILABLE - 404 response');
          return {
            success: true,
            center: center.name,
            treatment: TREATMENTS[treatment]?.name,
            slots: [],
            slotsBeforeFilter: 0,
            rawSlotCount: 0,
            apiDebug: { status: 404, requestBody: requestBody, reason: '404 from Smart Agenda API' },
            message: `No hay disponibilidad en ${center.name} en los próximos días.`
          };
        }

        const rawData = await response.text();
        console.log('[ADMIN-TEST-CHAT] Availability raw response:', rawData.substring(0, 500));

        let data;
        try {
          data = JSON.parse(rawData);
        } catch (e) {
          console.error('[ADMIN-TEST-CHAT] Failed to parse availability response:', e.message);
          return { success: true, center: center.name, treatment: TREATMENTS[treatment]?.name, slots: [], apiDebug: { status: response.status, rawPreview: rawData.substring(0, 200) }, message: `Error al consultar disponibilidad en ${center.name}.` };
        }

        // Store API debug info for troubleshooting
        const apiDebug = {
          status: response.status,
          requestBody: requestBody,
          rawDaysCount: Array.isArray(data) ? data.length : 0,
          rawFirstDay: Array.isArray(data) && data.length > 0 ? data[0].dj : null,
          rawFirstDaySlots: Array.isArray(data) && data.length > 0 ? data[0].det?.length : 0
        };
        const dayNames = { 'Monday': 'Lunes', 'Tuesday': 'Martes', 'Wednesday': 'Miércoles', 'Thursday': 'Jueves', 'Friday': 'Viernes', 'Saturday': 'Sábado', 'Sunday': 'Domingo' };
        const slots = [];

        for (const day of (data || [])) {
          const times = day.det?.map(slot => slot.idp) || [];
          if (times.length > 0) {
            slots.push({
              dayName: dayNames[day.nj] || day.nj,
              date: day.dj,
              displayDate: formatSpanishDate(day.dj),
              times,
              timesFormatted: times.join(', ')
            });
          }
        }

        console.log(`[ADMIN-TEST-CHAT] Availability result: ${slots.length} days with slots found (before filtering)`);

        // Apply optimal slot filtering: max 3 days, 3 spaced slots per day
        const filteredSlots = filterOptimalSlots(slots);

        if (filteredSlots.length === 0) {
          console.log('[ADMIN-TEST-CHAT] NO SLOTS AVAILABLE - empty result');
        } else {
          console.log(`[ADMIN-TEST-CHAT] Filtered to ${filteredSlots.length} days:`);
          filteredSlots.forEach(s => console.log(`[ADMIN-TEST-CHAT]   ${s.date}: ${s.times.join(', ')}`));
        }

        return {
          success: true,
          center: center.name,
          treatment: TREATMENTS[treatment]?.name || treatment,
          price: TREATMENTS[treatment]?.price || 0,
          slots: filteredSlots,
          slotsBeforeFilter: slots.length,  // DEBUG: How many days before filtering
          rawSlotCount: slots.reduce((sum, d) => sum + (d.times?.length || 0), 0),  // DEBUG: Total raw slots
          apiDebug: apiDebug,  // DEBUG: Raw API response info
          message: filteredSlots.length === 0 ? `No hay disponibilidad en ${center.name} actualmente. Te recomendamos consultar otro centro o contactar por WhatsApp: +34 689 560 130` : null
        };
      } catch (error) {
        console.error('[ADMIN-TEST-CHAT] Availability error:', error.message);
        return { success: false, error: 'api_error', message: 'Error al consultar disponibilidad.' };
      }
    }

    case 'create_booking': {
      const { center, treatment, date, time, full_name, email, phone } = args;

      if (!center || !treatment || !date || !time || !full_name || !email || !phone) {
        return { success: false, error: 'missing_fields', message: 'Faltan datos para la reserva.' };
      }

      // Block recaida bookings - must be managed by staff
      if (treatment.toLowerCase() === 'recaida') {
        return {
          success: false,
          error: 'recaida_not_allowed',
          message: 'Las sesiones de recaída las gestiona el equipo directamente. Por favor, contacta por WhatsApp: +34 689 560 130'
        };
      }

      if (!email.includes('@')) {
        return { success: false, error: 'invalid_email', message: 'El email no es válido.' };
      }

      const phoneDigits = phone.replace(/\D/g, '');
      if (phoneDigits.length < 9) {
        return { success: false, error: 'invalid_phone', message: 'El teléfono debe tener al menos 9 dígitos.' };
      }

      const centerInfo = CENTERS[center.toLowerCase()];
      if (!centerInfo) {
        return { success: false, error: 'invalid_center', message: `Centro no válido: ${center}` };
      }

      const typeId = APPOINTMENT_TYPES[centerInfo.agendaId]?.[treatment.toLowerCase()];
      if (!typeId) {
        return { success: false, error: 'invalid_treatment', message: `Tratamiento no válido: ${treatment}` };
      }

      try {
        // Check if Smart Agenda credentials are configured
        if (!process.env.SMART_AGENDA_LOGIN || !process.env.SMART_AGENDA_PWD) {
          console.error('[ADMIN-TEST-CHAT] Smart Agenda credentials not configured!');
          return { success: false, error: 'config_error', message: 'Smart Agenda no está configurado. Contacta al administrador.' };
        }

        // Get or create client
        console.log('[ADMIN-TEST-CHAT] Fetching clients...');
        const clientsResponse = await smartAgendaRequest('/pdo_client');
        if (!clientsResponse.ok) {
          const errorText = await clientsResponse.text();
          console.error('[ADMIN-TEST-CHAT] Failed to get clients:', clientsResponse.status, errorText);
          throw new Error(`Failed to get clients: ${clientsResponse.status}`);
        }
        const clients = await clientsResponse.json();
        let client = clients.find(c => c.mail === email);

        // Parse name (needed for both new client and appointment)
        const nameParts = full_name.trim().split(' ');
        const lastName = nameParts[nameParts.length - 1];
        const firstName = nameParts.slice(0, -1).join(' ') || lastName;

        if (!client) {
          console.log('[ADMIN-TEST-CHAT] Creating new client:', { firstName, lastName, email, phone });
          const createResponse = await smartAgendaRequest('/pdo_client', {
            method: 'POST',
            body: JSON.stringify({ nom: lastName, prenom: firstName, mail: email, telephone: phone })
          });
          if (!createResponse.ok) {
            const errorText = await createResponse.text();
            console.error('[ADMIN-TEST-CHAT] Failed to create client:', createResponse.status, errorText);
            throw new Error(`Failed to create client: ${createResponse.status}`);
          }
          client = await createResponse.json();
          console.log('[ADMIN-TEST-CHAT] Client created:', client.id);
        } else {
          console.log('[ADMIN-TEST-CHAT] Existing client found:', client.id);
        }

        if (!client?.id) {
          throw new Error('Failed to create/get client - no ID returned');
        }

        // Get resource
        const resourcesResponse = await smartAgendaRequest('/pdo_ressource');
        const resources = await resourcesResponse.json();
        const resourceId = resources.find(r => r.id === '-1')?.id || resources[0]?.id || '-1';
        console.log('[ADMIN-TEST-CHAT] Using resource ID:', resourceId);

        // VALIDATION: Check if slot is actually available before booking
        console.log('[ADMIN-TEST-CHAT] Validating slot availability before booking...');
        const availCheckResponse = await smartAgendaRequest('/service/getAvailabilities', {
          method: 'POST',
          body: JSON.stringify({
            pdo_type_rdv_id: typeId,
            pdo_agenda_id: centerInfo.agendaId,
            date_a_partir_de: date,
            date_fin: date
          })
        });

        if (availCheckResponse.ok) {
          const availCheckData = await availCheckResponse.json();
          const daySlots = Array.isArray(availCheckData) ? availCheckData.find(d => d.dj === date) : null;
          const isTimeAvailable = daySlots?.det?.some(s => s.idp === time);

          console.log(`[ADMIN-TEST-CHAT] Slot validation: date=${date}, time=${time}, available=${isTimeAvailable}`);
          console.log(`[ADMIN-TEST-CHAT] Available times for ${date}:`, daySlots?.det?.map(s => s.idp).join(', ') || 'none');

          if (!isTimeAvailable) {
            console.log('[ADMIN-TEST-CHAT] SLOT NOT AVAILABLE - blocking booking');
            return {
              success: false,
              error: 'slot_unavailable',
              message: `El horario ${time} del ${date} ya no está disponible. Por favor consulta la disponibilidad nuevamente.`
            };
          }
        } else {
          console.log('[ADMIN-TEST-CHAT] WARNING: Could not validate slot availability, proceeding anyway');
        }

        // Create appointment
        const duration = TREATMENTS[treatment.toLowerCase()]?.duration || 60;
        const startDateTime = `${date}T${time}:00`;
        const endDate = new Date(startDateTime);
        endDate.setMinutes(endDate.getMinutes() + duration);

        const appointmentPayload = {
          client_id: client.id,
          client_nom: lastName,  // Required by API (matches working laserostop_bf)
          presta_id: typeId,
          ressource_id: resourceId,
          start_date: startDateTime,
          end_date: endDate.toISOString().slice(0, 19),
          equipe_id: centerInfo.agendaId,
          statut: 'C'  // Status: C = Confirmed (appears directly in agenda)
        };
        console.log('[ADMIN-TEST-CHAT] Creating appointment:', JSON.stringify(appointmentPayload));

        const appointmentResponse = await smartAgendaRequest('/pdo_events', {
          method: 'POST',
          body: JSON.stringify(appointmentPayload)
        });

        if (!appointmentResponse.ok) {
          const errorText = await appointmentResponse.text();
          console.error('[ADMIN-TEST-CHAT] Failed to create appointment:', appointmentResponse.status, errorText);
          throw new Error(`Failed to create appointment: ${appointmentResponse.status} - ${errorText}`);
        }

        const appointment = await appointmentResponse.json();
        console.log('[ADMIN-TEST-CHAT] Appointment response:', JSON.stringify(appointment));

        if (!appointment?.id) {
          console.error('[ADMIN-TEST-CHAT] No appointment ID in response:', JSON.stringify(appointment));
          throw new Error('No appointment ID returned');
        }

        console.log('[ADMIN-TEST-CHAT] Booking created with ID:', appointment.id);

        // CRITICAL: Verify the booking was actually created by fetching it back
        console.log('[ADMIN-TEST-CHAT] Verifying booking exists...');
        const verifyResponse = await smartAgendaRequest(`/pdo_events/${appointment.id}`);
        if (!verifyResponse.ok) {
          console.error(`[ADMIN-TEST-CHAT] CRITICAL: Booking verification FAILED! ID ${appointment.id} not found (status: ${verifyResponse.status})`);
          throw new Error(`Booking created but verification failed - ID ${appointment.id} does not exist`);
        }
        const verifiedBooking = await verifyResponse.json();
        console.log('[ADMIN-TEST-CHAT] Booking VERIFIED:', JSON.stringify(verifiedBooking));
        console.log(`[ADMIN-TEST-CHAT] BOOKING SUCCESS! Verified ID: ${verifiedBooking.id}, Client: ${verifiedBooking.client_id}, Date: ${verifiedBooking.start_date}`);

        // Log booking stats
        try {
          const { getRedisClient } = require('./shared/redis-client');
          const redisClient = await getRedisClient();
          if (redisClient) {
            const today = new Date().toISOString().split('T')[0];
            await redisClient.incr('chatbot:stats:bookings:total');
            await redisClient.incr(`chatbot:stats:bookings:${today}`);
            await redisClient.incr(`chatbot:stats:bookings:center:${center}`);
            await redisClient.incr(`chatbot:stats:bookings:treatment:${treatment}`);
            await redisClient.quit();
          }
        } catch (e) {
          console.error('[ADMIN-TEST-CHAT] Failed to log booking stats:', e.message);
        }

        // Get payment links for this booking
        const paymentLinks = getPaymentLinks(centerInfo.agendaId, treatment.toLowerCase());

        return {
          success: true,
          appointmentId: appointment.id,
          center: centerInfo.name,
          treatment: TREATMENTS[treatment.toLowerCase()]?.name || treatment,
          price: TREATMENTS[treatment.toLowerCase()]?.price || 0,
          date,
          time,
          displayDate: formatSpanishDate(date),
          customerName: full_name,
          paymentLinks: paymentLinks,
          message: `Reserva confirmada en ${centerInfo.name} para el ${formatSpanishDate(date)} a las ${time}.`
        };

      } catch (error) {
        console.error('[ADMIN-TEST-CHAT] Booking error:', error.message);
        return { success: false, error: 'booking_failed', message: 'No se pudo crear la reserva. WhatsApp: +34 689 560 130' };
      }
    }

    case 'get_center_info': {
      if (args.center === 'all') {
        return {
          success: true,
          centers: Object.entries(CENTERS).map(([key, info]) => ({
            key,
            name: info.name,
            ...CENTER_DETAILS[key]
          }))
        };
      }

      const details = CENTER_DETAILS[args.center?.toLowerCase()];
      if (!details) {
        return { success: false, error: 'invalid_center', message: `Centro no encontrado: ${args.center}` };
      }

      return { success: true, ...details };
    }

    case 'log_callback': {
      const { phone, name, email, question, center, treatment } = args;

      if (!phone) {
        return { success: false, error: 'missing_phone', message: 'Se requiere el número de teléfono.' };
      }

      try {
        // Determine which tab to write to
        const tabName = center && SHEET_TABS[center.toLowerCase()]
          ? SHEET_TABS[center.toLowerCase()]
          : SHEET_TABS.general;

        // Format timestamp
        const timestamp = new Date().toLocaleString('es-ES', {
          timeZone: 'Europe/Madrid',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });

        // Prepare row data: [Timestamp, Phone, Name, Email, Question, Center, Treatment]
        const rowData = [
          timestamp,
          phone,
          name || '',
          email || '',
          question || '',
          center ? (CENTER_DETAILS[center.toLowerCase()]?.name || center) : '',
          treatment ? (TREATMENTS[treatment.toLowerCase()]?.name || treatment) : ''
        ];

        console.log(`[ADMIN-TEST-CHAT] Logging callback to ${tabName}:`, rowData);

        const result = await appendToGoogleSheet(tabName, rowData);

        if (result.success) {
          console.log(`[ADMIN-TEST-CHAT] Callback logged successfully to ${tabName}`);
          return {
            success: true,
            message: `Callback registrado. Un agente llamará al ${phone} lo antes posible.`,
            tab: tabName
          };
        } else {
          console.error(`[ADMIN-TEST-CHAT] Failed to log callback:`, result.error);
          // Still return success to user, but log the error
          return {
            success: true,
            message: `Solicitud de callback recibida. Un agente llamará al ${phone} lo antes posible.`,
            warning: 'Log to sheet failed but callback noted'
          };
        }
      } catch (error) {
        console.error('[ADMIN-TEST-CHAT] Callback logging error:', error.message);
        // Don't fail the user experience even if logging fails
        return {
          success: true,
          message: `Solicitud de callback recibida. Un agente llamará al ${phone} lo antes posible.`,
          error: error.message
        };
      }
    }

    default:
      return { success: false, error: 'unknown_tool', message: `Herramienta desconocida: ${toolName}` };
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const authHeader = event.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '');

  if (!token) {
    return { statusCode: 401, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Authorization required' }) };
  }

  const isValid = await validateAdminSession(token);
  if (!isValid) {
    return { statusCode: 401, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Invalid or expired session' }) };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { message, conversationHistory = [] } = body;

    if (!message || typeof message !== 'string') {
      return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Message is required' }) };
    }

    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'OpenAI API key not configured' }) };
    }

    const startTime = Date.now();

    // Build messages array
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...conversationHistory.slice(-8),
      { role: 'user', content: message }
    ];

    // Detect if user is confirming a booking (simple pattern match)
    const isConfirmation = message.toLowerCase().match(/^(si|sí|ok|confirmo|adelante|yes|vale|claro|por supuesto|de acuerdo|perfecto|genial)/);

    // Check if a booking was ALREADY created in this conversation
    // Look for actual booking confirmation patterns with appointment IDs
    const bookingAlreadyCreated = conversationHistory.some(m => {
      if (!m.content || m.role !== 'assistant') return false;
      // Must have an actual booking ID number (4+ digits after "reserva")
      const hasBookingId = /(?:número de reserva|reserva)[:\s]+(\d{4,})/i.test(m.content);
      // Or explicit "ha sido confirmada" with a number
      const hasConfirmWithId = m.content.toLowerCase().includes('ha sido confirmada') && /\d{4,}/.test(m.content);
      return hasBookingId || hasConfirmWithId;
    });

    if (bookingAlreadyCreated && isConfirmation) {
      console.log('[ADMIN-TEST-CHAT] Booking already exists in conversation - returning acknowledgment');
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          response: '¡Tu reserva ya está confirmada! Si necesitas hacer algún cambio o tienes alguna pregunta, no dudes en contactarnos por WhatsApp: +34 689 560 130',
          tokens: 0,
          responseTime: Date.now() - startTime,
          bookingCreated: false,
          appointmentId: null,
          debug: { toolsCalled: [], note: 'Booking already existed in conversation' }
        })
      };
    }

    // Check if conversation history suggests we're in a booking flow
    // Look for: confirmation questions, email/phone patterns, booking summaries
    const historyHasBookingData = conversationHistory.some(m => {
      if (!m.content) return false;
      const content = m.content.toLowerCase();
      return (
        content.includes('¿confirmo') ||
        content.includes('confirmo la reserva') ||
        content.includes('resumen') ||
        content.includes('@') ||  // Email was mentioned
        /\d{9}/.test(m.content) ||  // Phone number pattern
        content.includes('nombre completo') ||
        content.includes('correo') ||
        content.includes('teléfono')
      );
    });

    // Force create_booking tool if user is confirming after booking data was collected
    // BUT only if no booking was already created
    let toolChoice = 'auto';
    if (isConfirmation && historyHasBookingData && !bookingAlreadyCreated) {
      console.log('[ADMIN-TEST-CHAT] Detected confirmation after booking data - forcing create_booking tool');
      toolChoice = { type: 'function', function: { name: 'create_booking' } };
    }

    // Call OpenAI with tools
    let response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        max_tokens: 300,
        temperature: 0.2,  // Low temperature for reliable tool calling
        tools: CHATBOT_TOOLS,
        tool_choice: toolChoice
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('[ADMIN-TEST-CHAT] OpenAI error:', errorData);
      return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Failed to generate response' }) };
    }

    let data = await response.json();
    let totalTokens = data.usage?.total_tokens || 0;
    let responseMessage = data.choices?.[0]?.message;

    console.log(`[ADMIN-TEST-CHAT] User message: "${message.substring(0, 50)}..."`);
    console.log(`[ADMIN-TEST-CHAT] GPT finish_reason: ${data.choices?.[0]?.finish_reason}`);

    // Track if create_booking was called
    let createBookingCalled = false;
    let bookingResult = null;
    let availabilityDebug = null;  // Debug info for availability
    let toolsCalled = [];  // Track which tools were called

    // Handle tool calls
    if (responseMessage?.tool_calls && responseMessage.tool_calls.length > 0) {
      console.log(`[ADMIN-TEST-CHAT] Tool calls: ${responseMessage.tool_calls.length}`);
      responseMessage.tool_calls.forEach(tc => {
        console.log(`[ADMIN-TEST-CHAT] - Tool: ${tc.function.name}, Args: ${tc.function.arguments.substring(0, 100)}...`);
      });

      const toolResults = [];
      for (const toolCall of responseMessage.tool_calls) {
        toolsCalled.push(toolCall.function.name);  // Track tool name

        let args;
        try {
          args = JSON.parse(toolCall.function.arguments);
        } catch (e) {
          args = {};
        }

        const toolStartTime = Date.now();
        const result = await executeToolCall(toolCall.function.name, args);

        // Log to Harbyx AASP for monitoring
        logToHarbyx(toolCall.function.name, args, result, {
          executionTimeMs: Date.now() - toolStartTime,
          conversationLength: conversationHistory.length
        });

        // Track create_booking results
        if (toolCall.function.name === 'create_booking') {
          createBookingCalled = true;
          bookingResult = result;
          console.log(`[ADMIN-TEST-CHAT] create_booking called - success: ${result.success}, appointmentId: ${result.appointmentId || 'none'}`);
        }

        // Capture debug info for check_availability
        if (toolCall.function.name === 'check_availability') {
          availabilityDebug = {
            center: result.center,
            treatment: result.treatment,
            slotsFound: result.slots?.length || 0,
            slotsBeforeFilter: result.slotsBeforeFilter || 0,
            rawSlotCount: result.rawSlotCount || 0,
            firstSlot: result.slots?.[0] ? `${result.slots[0].date} ${result.slots[0].times?.[0]}` : null,
            apiDebug: result.apiDebug || null
          };
          console.log(`[ADMIN-TEST-CHAT] Availability debug: ${JSON.stringify(availabilityDebug)}`);
        }

        // CRITICAL: Add explicit instruction if no availability found
        if (toolCall.function.name === 'check_availability' && result.success && (!result.slots || result.slots.length === 0)) {
          console.log('[ADMIN-TEST-CHAT] Empty availability - adding explicit instruction to GPT');
          result.instruction = 'IMPORTANTE: No hay horarios disponibles. DEBES informar al usuario que no hay disponibilidad en este centro actualmente y ofrecer consultar otro centro o contactar por WhatsApp: +34 689 560 130. NO inventes horarios.';
        }

        toolResults.push({
          tool_call_id: toolCall.id,
          role: 'tool',
          content: JSON.stringify(result)
        });
      }

      // Send tool results back to GPT
      const finalMessages = [...messages, responseMessage, ...toolResults];

      // DEBUG: Log what we're sending to GPT
      console.log('[ADMIN-TEST-CHAT] Tool results being sent to GPT:');
      toolResults.forEach(tr => {
        const parsed = JSON.parse(tr.content);
        console.log(`[ADMIN-TEST-CHAT]   Tool result - success: ${parsed.success}, slots: ${parsed.slots?.length || 0}, center: ${parsed.center}`);
        if (parsed.slots?.length > 0) {
          console.log(`[ADMIN-TEST-CHAT]   First slot: ${parsed.slots[0]?.date} ${parsed.slots[0]?.times?.[0]}`);
        }
      });

      response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: finalMessages,
          max_tokens: 300,
          temperature: 0.2  // Low temperature for consistent responses
        })
      });

      if (!response.ok) {
        return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Failed to generate final response' }) };
      }

      data = await response.json();
      totalTokens += data.usage?.total_tokens || 0;
      responseMessage = data.choices?.[0]?.message;

      // DEBUG: Log GPT's response after processing tool results
      console.log('[ADMIN-TEST-CHAT] GPT response after tool results:');
      console.log(`[ADMIN-TEST-CHAT]   Content preview: ${responseMessage?.content?.substring(0, 150)}...`);
    } else {
      // No tool calls - detect and fix fake confirmations
      const content = responseMessage?.content || '';
      const looksLikeConfirmation = content.toLowerCase().includes('confirmad') ||
                                     content.toLowerCase().includes('reserva creada') ||
                                     content.toLowerCase().includes('reserva lista') ||
                                     content.toLowerCase().includes('cita confirmada') ||
                                     content.includes('🎉');
      const userSaidYes = message.toLowerCase().match(/^(si|sí|ok|confirmo|adelante|yes|vale|claro)/);

      if (looksLikeConfirmation && userSaidYes && !createBookingCalled) {
        console.log(`[ADMIN-TEST-CHAT] CRITICAL: Fake confirmation detected! Fixing response...`);
        console.log(`[ADMIN-TEST-CHAT] Original response: "${content.substring(0, 100)}..."`);
        // Override the fake confirmation with a proper message
        responseMessage.content = 'Hubo un problema al procesar la reserva. Por favor, proporciona de nuevo tus datos (nombre, email y teléfono) para que pueda completar la reserva correctamente.';
      }
    }

    const responseTime = Date.now() - startTime;
    let botResponse = responseMessage?.content || 'No response generated';

    // Strip markdown from response
    botResponse = stripMarkdown(botResponse);

    console.log(`[ADMIN-TEST-CHAT] Final response (${totalTokens} tokens, ${responseTime}ms)`);

    // Log if booking was confirmed
    if (createBookingCalled && bookingResult?.success) {
      console.log(`[ADMIN-TEST-CHAT] BOOKING CONFIRMED - ID: ${bookingResult.appointmentId}`);
    }

    // Capture debug info about tool calls
    const debugInfo = {
      toolsCalled: toolsCalled,
      availability: availabilityDebug
    };

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        response: botResponse,
        tokens: totalTokens,
        responseTime,
        bookingCreated: createBookingCalled && bookingResult?.success,
        appointmentId: bookingResult?.appointmentId || null,
        debug: debugInfo
      })
    };

  } catch (error) {
    console.error('[ADMIN-TEST-CHAT] Error:', error.message);
    return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Server error' }) };
  }
};
