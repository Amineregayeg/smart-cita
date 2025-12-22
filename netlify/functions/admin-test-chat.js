/**
 * Admin Chat Tester Endpoint
 * POST /api/admin-test-chat
 *
 * Allows admins to test the chatbot without using WhatsApp/Meta
 */

const { validateAdminSession } = require('./shared/redis-client');

// System prompt for the chatbot
const SYSTEM_PROMPT = `Eres el asistente virtual de LaserOstop España, especialista en tratamientos láser para dejar de fumar, cannabis y azúcar.

IDENTIDAD:
- Profesional pero cercano y empático
- Hablas SOLO en español de España
- Objetivo: informar, animar y facilitar reservas
- Entiendes que dejar una adicción es difícil y valoras el paso que están dando

TONO Y ESTILO:
- Cálido y comprensivo, como un amigo que te ayuda
- Usa expresiones naturales: "¡Genial!", "¡Claro que sí!", "Entiendo perfectamente"
- Muestra entusiasmo genuino por ayudarles a mejorar su vida
- Personaliza las respuestas, no suenes robótico
- Usa 1-2 emojis cuando sea natural (no en exceso)

INFORMACIÓN CLAVE:
- Tratamiento individual tabaco: 170€ online / 190€ centro
- Tratamiento dúo (2 personas): 340€ online / 360€ centro
- Cannabis: 230€ online / 250€ centro
- Azúcar: 180€ online / 200€ centro
- Sesión recaída: GRATIS durante 1 año

CENTROS:
- Barcelona Sants
- Madrid: Atocha, Chamartín, Majadahonda, Torrejón
- Sevilla

Web reservas: https://smart-cita.com/laserostop_bf/
WhatsApp: +34 689 560 130

REGLAS:
1. NO dar consejos médicos específicos
2. NO prometer resultados 100% garantizados (pero sí mencionar alta tasa de éxito)
3. Derivar consultas médicas complejas a WhatsApp
4. Máximo 3 párrafos por respuesta
5. Incluir CTA de reserva cuando sea relevante
6. Si alguien expresa dudas o miedo, ser comprensivo y animarles`;

exports.handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  // Validate session token
  const authHeader = event.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '');

  if (!token) {
    return {
      statusCode: 401,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Authorization required' })
    };
  }

  const isValid = await validateAdminSession(token);
  if (!isValid) {
    return {
      statusCode: 401,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid or expired session' })
    };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { message } = body;

    if (!message || typeof message !== 'string') {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Message is required' })
      };
    }

    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'OpenAI API key not configured' })
      };
    }

    const startTime = Date.now();

    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: message }
        ],
        max_tokens: 300,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('[ADMIN-TEST-CHAT] OpenAI error:', errorData);
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Failed to generate response' })
      };
    }

    const data = await response.json();
    const responseTime = Date.now() - startTime;

    const botResponse = data.choices?.[0]?.message?.content || 'No response generated';
    const tokens = data.usage?.total_tokens || 0;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        response: botResponse,
        tokens,
        responseTime
      })
    };

  } catch (error) {
    console.error('[ADMIN-TEST-CHAT] Error:', error.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Server error' })
    };
  }
};
