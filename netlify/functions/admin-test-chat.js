/**
 * Admin Chat Tester Endpoint
 * POST /api/admin-test-chat
 *
 * Allows admins to test the chatbot with full tool calling support (availability + booking)
 */

const { validateAdminSession } = require('./shared/redis-client');

// System prompt with booking capabilities
const SYSTEM_PROMPT = `Eres el asistente virtual de LaserOstop España, especialista en tratamientos láser para dejar adicciones.

## IDENTIDAD
- Nombre: Asistente LaserOstop
- Rol: Community Manager / Atención al cliente
- Idioma: SOLO español de España
- Tono: Profesional, cercano y empático

## CAPACIDADES

Tienes acceso a herramientas para:
1. **Consultar disponibilidad** - check_availability
2. **Crear reservas** - create_booking
3. **Información de centros** - get_center_info

## CENTROS DISPONIBLES (6)
- Barcelona Sants
- Sevilla
- Madrid Chamartín
- Madrid Atocha
- Majadahonda
- Torrejón de Ardoz

## TRATAMIENTOS Y PRECIOS
- Individual (tabaco): 190€ en centro
- Dúo (2 personas): 360€ total (180€/persona)
- Cannabis: 250€
- Azúcar: 200€
- Recaída: GRATIS durante 1 año

## FLUJO DE RESERVA

Cuando alguien quiera reservar, sigue este flujo:

1. **Pregunta el centro** - "¿En qué centro te viene mejor?"
2. **Pregunta el tratamiento** - "¿Vienes solo o en pareja? ¿Es para tabaco, cannabis o azúcar?"
3. **Consulta disponibilidad** - Usa check_availability y presenta las opciones
4. **El usuario elige horario** - Confirma su elección
5. **Recoge datos** - Pide nombre completo, email y teléfono
6. **CONFIRMA antes de reservar** - Muestra resumen y pregunta "¿Confirmo la reserva?"
7. **Solo con confirmación** - Usa create_booking

## REGLAS CRÍTICAS DE RESERVA

- NUNCA inventes horarios - SIEMPRE usa check_availability
- NUNCA crees reserva sin confirmación EXPLÍCITA del usuario ("sí", "confirmo", "adelante")
- Si no hay disponibilidad, ofrece otros centros cercanos
- Valida email (debe tener @) y teléfono (mínimo 9 dígitos)
- Si algo falla, ofrece WhatsApp: +34 689 560 130

## FORMATO DE RESPUESTAS

- Máximo 2-3 párrafos cortos (100 palabras)
- Un emoji máximo por mensaje
- Cuando muestres horarios, usa formato claro:
  📅 Lunes 23 dic: 09:00, 11:00, 15:00
  📅 Martes 24 dic: 10:00, 14:00

Responde de forma natural, como un asesor real de LaserOstop.`;

// Tool definitions
const CHATBOT_TOOLS = [
  {
    type: "function",
    function: {
      name: "check_availability",
      description: "Consultar disponibilidad de citas en un centro LaserOstop.",
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
          },
          days_ahead: {
            type: "number",
            description: "Número de días a consultar"
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
      description: "Crear una reserva de cita. Solo llamar después de confirmación explícita del usuario.",
      parameters: {
        type: "object",
        properties: {
          center: {
            type: "string",
            enum: ["barcelona", "sevilla", "chamartin", "atocha", "torrejon", "majadahonda"]
          },
          treatment: { type: "string", enum: ["tabaco", "duo", "cannabis", "azucar"] },
          date: { type: "string", description: "Fecha YYYY-MM-DD" },
          time: { type: "string", description: "Hora HH:MM" },
          full_name: { type: "string" },
          email: { type: "string" },
          phone: { type: "string" }
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
  'tabaco': { name: 'Dejar de fumar (individual)', duration: 60, price: 190 },
  'duo': { name: 'Dejar de fumar (dúo)', duration: 90, price: 360 },
  'cannabis': { name: 'Adicción al cannabis', duration: 60, price: 250 },
  'azucar': { name: 'Adicción al azúcar', duration: 60, price: 200 }
};

const CENTER_DETAILS = {
  'barcelona': { name: 'LaserOstop Barcelona Sants', address: 'Carrer de Galileu, 65, Sants-Montjuïc, 08028 Barcelona', phone: '+34 689 560 130' },
  'sevilla': { name: 'LaserOstop Sevilla', address: 'Avenida Eduardo Dato 85, 41005 Sevilla', phone: '+34 689 560 130' },
  'chamartin': { name: 'LaserOstop Madrid Chamartín', address: 'Calle de Oruro, 9, Chamartín, 28016 Madrid', phone: '+34 919 305 313' },
  'atocha': { name: 'LaserOstop Madrid Atocha', address: 'Calle Canarias 26, Atocha, 28045 Madrid', phone: '+34 613 255 948' },
  'torrejon': { name: 'LaserOstop Torrejón de Ardoz', address: 'Calle Pesquera, 10, 28850 Torrejón de Ardoz', phone: '+34 919 305 313' },
  'majadahonda': { name: 'LaserOstop Majadahonda', address: 'Calle del Dr Calero, 19, Centro comercial Tutti, 28220 Majadahonda', phone: '+34 919 305 313' }
};

// Token cache for Smart Agenda
let tokenCache = { token: null, expiry: null };

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
      endDate.setDate(endDate.getDate() + (args.days_ahead || 14));

      try {
        const response = await smartAgendaRequest('/service/getAvailabilities', {
          method: 'POST',
          body: JSON.stringify({
            pdo_type_rdv_id: typeId,
            pdo_agenda_id: center.agendaId,
            date_a_partir_de: startDate.toISOString().split('T')[0],
            date_fin: endDate.toISOString().split('T')[0]
          })
        });

        if (response.status === 404) {
          return { success: true, center: center.name, treatment: TREATMENTS[treatment]?.name, slots: [], message: `No hay disponibilidad en ${center.name} en los próximos días.` };
        }

        const data = await response.json();
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

        return {
          success: true,
          center: center.name,
          treatment: TREATMENTS[treatment]?.name || treatment,
          price: TREATMENTS[treatment]?.price || 0,
          slots
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

        if (!client) {
          const nameParts = full_name.trim().split(' ');
          const lastName = nameParts[nameParts.length - 1];
          const firstName = nameParts.slice(0, -1).join(' ') || lastName;

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

        // Create appointment
        const duration = TREATMENTS[treatment.toLowerCase()]?.duration || 60;
        const startDateTime = `${date}T${time}:00`;
        const endDate = new Date(startDateTime);
        endDate.setMinutes(endDate.getMinutes() + duration);

        const appointmentPayload = {
          client_id: client.id,
          presta_id: typeId,
          ressource_id: resourceId,
          start_date: startDateTime,
          end_date: endDate.toISOString().slice(0, 19),
          equipe_id: centerInfo.agendaId,
          internet: 'O'
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

        console.log('[ADMIN-TEST-CHAT] Booking SUCCESS! Appointment ID:', appointment.id);

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

    // Call OpenAI with tools
    let response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        max_tokens: 300,
        temperature: 0.7,
        tools: CHATBOT_TOOLS,
        tool_choice: 'auto'
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

    // Handle tool calls
    if (responseMessage?.tool_calls && responseMessage.tool_calls.length > 0) {
      console.log(`[ADMIN-TEST-CHAT] Tool calls: ${responseMessage.tool_calls.length}`);

      const toolResults = [];
      for (const toolCall of responseMessage.tool_calls) {
        let args;
        try {
          args = JSON.parse(toolCall.function.arguments);
        } catch (e) {
          args = {};
        }

        const result = await executeToolCall(toolCall.function.name, args);
        toolResults.push({
          tool_call_id: toolCall.id,
          role: 'tool',
          content: JSON.stringify(result)
        });
      }

      // Send tool results back to GPT
      const finalMessages = [...messages, responseMessage, ...toolResults];

      response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: finalMessages,
          max_tokens: 300,
          temperature: 0.7
        })
      });

      if (!response.ok) {
        return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Failed to generate final response' }) };
      }

      data = await response.json();
      totalTokens += data.usage?.total_tokens || 0;
      responseMessage = data.choices?.[0]?.message;
    }

    const responseTime = Date.now() - startTime;
    const botResponse = responseMessage?.content || 'No response generated';

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        response: botResponse,
        tokens: totalTokens,
        responseTime
      })
    };

  } catch (error) {
    console.error('[ADMIN-TEST-CHAT] Error:', error.message);
    return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Server error' }) };
  }
};
