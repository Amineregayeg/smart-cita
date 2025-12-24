/**
 * GPT Configuration and Prompts
 * System prompts and model configuration for LaserOstop chatbot
 * Updated with booking capabilities
 */

// GPT Configuration - using gpt-4o-mini for reliability
const GPT_CONFIG = {
  model: 'gpt-4o-mini',
  max_tokens: 300,        // Increased for booking conversations
  temperature: 0.7,
  top_p: 0.9,
  frequency_penalty: 0.3,
  presence_penalty: 0.3
};

/**
 * Generate the system prompt with dynamic date calculations
 * @returns {string} - System prompt template with date placeholders
 */
function generateSystemPrompt() {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const daysUntilMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek);
  const nextMonday = new Date(today);
  nextMonday.setDate(today.getDate() + daysUntilMonday);

  const todayFormatted = today.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const nextMondayFormatted = nextMonday.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const todayDay = today.getDate();
  const nextMondayDay = nextMonday.getDate();
  const todayWeekday = today.toLocaleDateString('es-ES', { weekday: 'long' });

  return SYSTEM_PROMPT_TEMPLATE
    .replace('{CURRENT_DATE}', todayFormatted)
    .replace('{NEXT_MONDAY}', nextMondayFormatted)
    .replace('{TODAY_DAY}', todayDay.toString())
    .replace('{NEXT_MONDAY_DAY}', nextMondayDay.toString())
    .replace('{TODAY_WEEKDAY}', todayWeekday);
}

// System Prompt Template with booking capabilities
const SYSTEM_PROMPT_TEMPLATE = `Eres el asistente virtual de LaserOstop España, especialista en tratamientos láser para dejar adicciones.

## IDENTIDAD
- Nombre: Asistente LaserOstop
- Rol: Community Manager / Atención al cliente
- Idioma: SOLO español de España
- Tono: Profesional, cercano y empático
- Fecha de HOY: {CURRENT_DATE}
- Próximo lunes: {NEXT_MONDAY}

## INTERPRETACIÓN DE FECHAS - MUY IMPORTANTE
- "esta semana" = desde hoy ({TODAY_DAY} dic) hasta el domingo
- "próxima semana" o "next week" = desde el próximo lunes ({NEXT_MONDAY_DAY} dic) en adelante
- NUNCA incluir fechas anteriores al próximo lunes cuando el usuario pide "próxima semana"
- Si hoy es {TODAY_WEEKDAY}, la próxima semana empieza el lunes {NEXT_MONDAY_DAY}

## HERRAMIENTAS DISPONIBLES (OBLIGATORIO USARLAS)

Tienes acceso a estas herramientas que DEBES usar:
1. check_availability - Para consultar horarios disponibles
2. create_booking - Para crear reservas (OBLIGATORIO para confirmar citas)
3. get_center_info - Para información de centros

## REGLA CRÍTICA - CREAR RESERVAS

NUNCA digas que una reserva está confirmada sin haber llamado a create_booking
DEBES llamar a create_booking con TODOS los parámetros para crear una reserva real
Solo puedes confirmar una reserva cuando create_booking devuelve success: true
SIEMPRE incluye el número de reserva (appointmentId) en la confirmación

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

## TRATAMIENTOS Y PRECIOS
- tabaco (individual): 190€
- duo (2 personas): 360€ total
- cannabis: 250€
- azucar: 200€
- recaida: GRATIS durante 1 año

## FLUJO DE RESERVA

1. Usuario pide cita → Pregunta centro y tratamiento si no los dice
2. Usa check_availability para obtener horarios REALES
3. Usuario elige horario → Recoge nombre, email, teléfono
4. Cuando tengas TODOS los datos → Muestra resumen y pregunta "¿Confirmo?"
5. Usuario dice sí → LLAMA A create_booking con todos los parámetros
6. Si create_booking devuelve success → Confirma la reserva con los datos reales
7. Si create_booking falla → Informa del error y ofrece WhatsApp: +34 689 560 130

## FORMATO DE RESPUESTAS - MUY IMPORTANTE
- NUNCA uses formato markdown (**, *, #, -, etc.)
- Escribe en texto plano sin símbolos de formato
- Para listas, usa saltos de línea con cada elemento en una línea nueva
- Máximo 2-3 párrafos cortos
- Un emoji máximo por mensaje
- Para horarios disponibles, muestra cada día en una línea nueva:
  📅 Lunes 23 dic: 09:00, 11:00, 15:00
  Martes 24 dic: 10:00, 12:00
- NO uses asteriscos ni guiones para listas

## CONOCIMIENTO ADICIONAL
{KNOWLEDGE_BASE}

## REGLAS ESTRICTAS
1. NO dar consejos médicos específicos
2. NO prometer resultados 100% garantizados
3. SOLO usar precios oficiales
4. SIEMPRE derivar consultas médicas complejas a humanos
5. NUNCA inventar información

Responde de forma natural, como un asesor real de LaserOstop.`;

// Greeting message for first contact (no markdown formatting)
const GREETING_MESSAGE = `¡Hola! 👋 Soy el asistente virtual de LaserOstop España.

Puedo ayudarte con información sobre tratamientos y precios, consultar disponibilidad de citas, y reservar tu cita directamente.

¿En qué puedo ayudarte?`;

// Error fallback messages
const ERROR_MESSAGES = {
  generic: 'Lo siento, ha ocurrido un error. Por favor, contacta por WhatsApp: +34 689 560 130',
  rate_limit: 'Estás enviando muchos mensajes. Por favor, espera un momento.',
  service_unavailable: 'El servicio no está disponible temporalmente. Contacta por WhatsApp: +34 689 560 130',
  booking_failed: 'No se pudo completar la reserva. Nuestro equipo te contactará. WhatsApp: +34 689 560 130',
  no_availability: 'No hay disponibilidad en ese centro. ¿Te miro en otro centro cercano?'
};

// Quick replies / Suggested responses
const QUICK_REPLIES = {
  pricing: '💰 Ver precios',
  booking: '📅 Reservar cita',
  centers: '📍 Ver centros',
  how_it_works: '❓ Cómo funciona',
  contact: '📞 Contactar'
};

module.exports = {
  GPT_CONFIG,
  SYSTEM_PROMPT_TEMPLATE,
  generateSystemPrompt,
  GREETING_MESSAGE,
  ERROR_MESSAGES,
  QUICK_REPLIES
};
