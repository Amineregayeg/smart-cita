# Implementation Plan: Option A - Check Availability + Book via Chatbot

**Date:** December 22, 2025
**Status:** Planning Phase

---

## Current Architecture Analysis

### What We Have

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CURRENT FLOW                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  WhatsApp/Meta ──► Netlify Webhook ──► Redis Queue ──► Render Worker    │
│                    (validate sig)      (LPUSH)         (BRPOP)          │
│                                                                          │
│                                            │                             │
│                                            ▼                             │
│                                    ┌──────────────┐                      │
│                                    │   GPT Call   │                      │
│                                    │  (no tools)  │                      │
│                                    └──────────────┘                      │
│                                            │                             │
│                                            ▼                             │
│                                    Send Text Response                    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Key Files

| Component | File | Purpose |
|-----------|------|---------|
| Webhook | `netlify/functions/webhook-whatsapp.js` | Receive WhatsApp messages |
| Webhook | `netlify/functions/webhook-meta.js` | Receive FB/IG messages |
| Queue | `netlify/functions/shared/redis-client.js` | Push to queue |
| Worker | `chatbot-processor/server.js` | Poll queue |
| Processor | `chatbot-processor/lib/message-processor.js` | Orchestrate flow |
| GPT | `chatbot-processor/lib/gpt-handler.js` | Call OpenAI |
| Session | Redis keys `chatbot:session:{platform}:{userId}` | 24h TTL |
| Booking API | `netlify/functions/api.js` | Smart Agenda integration |

### Session Structure (Current)

```javascript
{
  conversationHistory: [
    { role: 'user', content: '...', timestamp: 123 },
    { role: 'assistant', content: '...', timestamp: 124 }
  ],
  startedAt: 1703234567890,
  messageCount: 5,
  lastMessageAt: 1703234600000
}
```

---

## Proposed Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           NEW FLOW WITH TOOLS                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  WhatsApp/Meta ──► Netlify Webhook ──► Redis Queue ──► Render Worker    │
│                                                                          │
│                                            │                             │
│                                            ▼                             │
│                                    ┌──────────────┐                      │
│                                    │   GPT Call   │                      │
│                                    │  WITH TOOLS  │◄────────────┐        │
│                                    └──────────────┘             │        │
│                                            │                    │        │
│                           ┌────────────────┼────────────────┐   │        │
│                           ▼                ▼                ▼   │        │
│                    ┌──────────┐    ┌──────────┐    ┌────────┴─┐│        │
│                    │  Text    │    │  Tool:   │    │  Tool:   ││        │
│                    │ Response │    │  Check   │    │  Create  ││        │
│                    │          │    │ Availab. │    │  Booking ││        │
│                    └──────────┘    └────┬─────┘    └────┬─────┘│        │
│                           │             │               │       │        │
│                           │             ▼               ▼       │        │
│                           │       Smart Agenda    Smart Agenda  │        │
│                           │          API              API       │        │
│                           │             │               │       │        │
│                           │             └───────────────┘       │        │
│                           │                     │               │        │
│                           │                     ▼               │        │
│                           │            Tool Result Back ────────┘        │
│                           │                                              │
│                           ▼                                              │
│                    Send Final Response                                   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Steps

### Phase 1: Smart Agenda Service Module

**New file:** `chatbot-processor/lib/smart-agenda-service.js`

```javascript
/**
 * Smart Agenda API Service
 * Provides availability checking and booking capabilities
 */

class SmartAgendaService {
  constructor() {
    this.baseUrl = 'https://www.smartagenda.fr/pro/laserostop-esh/api';
    this.credentials = {
      login: process.env.SMART_AGENDA_LOGIN,
      pwd: process.env.SMART_AGENDA_PWD,
      api_id: process.env.SMART_AGENDA_API_ID,
      api_key: process.env.SMART_AGENDA_API_KEY
    };
    this.tokenCache = { token: null, expiry: null };
  }

  // Center mapping
  static CENTERS = {
    'barcelona': { id: '43', name: 'Barcelona Sants', typeId: '20' },
    'sevilla': { id: '44', name: 'Sevilla', typeId: '32' },
    'chamartin': { id: '48', name: 'Madrid Chamartín', typeId: '44' },
    'torrejon': { id: '49', name: 'Torrejón de Ardoz', typeId: '53' },
    'atocha': { id: '50', name: 'Madrid Atocha', typeId: '63' },
    'majadahonda': { id: '51', name: 'Majadahonda', typeId: '72' }
  };

  // Treatment type mapping per center
  static TREATMENTS = {
    'tabaco': { kind: 'solo_cig', name: 'Dejar de fumar' },
    'duo': { kind: 'duo_cig', name: 'Dejar de fumar Dúo' },
    'cannabis': { kind: 'solo_drugs', name: 'Cannabis' },
    'azucar': { kind: 'solo_sugar', name: 'Azúcar' },
    'recaida': { kind: 'rechute', name: 'Recaída' }
  };

  async getToken() { /* Token management */ }

  async checkAvailability(centerKey, treatmentKey, daysAhead = 14) {
    // Returns formatted slots for GPT to present
  }

  async createBooking(details) {
    // Creates booking via API
    // Returns confirmation or error
  }
}
```

### Phase 2: OpenAI Function/Tool Definitions

**Update:** `chatbot-processor/config/tools.js`

```javascript
const CHATBOT_TOOLS = [
  {
    type: "function",
    function: {
      name: "check_availability",
      description: "Check available appointment slots for a LaserOstop center. Call this when user wants to know available times or wants to book.",
      parameters: {
        type: "object",
        properties: {
          center: {
            type: "string",
            enum: ["barcelona", "sevilla", "chamartin", "atocha", "torrejon", "majadahonda"],
            description: "The center to check availability for"
          },
          treatment: {
            type: "string",
            enum: ["tabaco", "duo", "cannabis", "azucar"],
            description: "Type of treatment. Default to 'tabaco' if not specified."
          },
          days_ahead: {
            type: "number",
            description: "Number of days to look ahead. Default 14."
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
      description: "Create a booking appointment. Only call after user has confirmed all details: center, date/time, name, email, phone.",
      parameters: {
        type: "object",
        properties: {
          center: {
            type: "string",
            enum: ["barcelona", "sevilla", "chamartin", "atocha", "torrejon", "majadahonda"]
          },
          treatment: {
            type: "string",
            enum: ["tabaco", "duo", "cannabis", "azucar"]
          },
          date: {
            type: "string",
            description: "Date in YYYY-MM-DD format"
          },
          time: {
            type: "string",
            description: "Time in HH:MM format"
          },
          full_name: {
            type: "string",
            description: "Customer's full name"
          },
          email: {
            type: "string",
            description: "Customer's email address"
          },
          phone: {
            type: "string",
            description: "Customer's phone number"
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
      description: "Get information about LaserOstop centers (addresses, contact info). Use when user asks about locations.",
      parameters: {
        type: "object",
        properties: {
          center: {
            type: "string",
            enum: ["barcelona", "sevilla", "chamartin", "atocha", "torrejon", "majadahonda", "all"],
            description: "Specific center or 'all' for all centers"
          }
        },
        required: ["center"]
      }
    }
  }
];
```

### Phase 3: Extended Session State

**Update session structure:**

```javascript
{
  conversationHistory: [...],
  startedAt: 1703234567890,
  messageCount: 5,
  lastMessageAt: 1703234600000,

  // NEW: Booking flow state
  bookingFlow: {
    state: 'idle', // 'idle' | 'checking' | 'selecting_slot' | 'collecting_info' | 'confirming'
    center: null,
    treatment: null,
    availableSlots: [],
    selectedSlot: null,
    customerInfo: {
      name: null,
      email: null,
      phone: null
    },
    lastUpdated: null
  }
}
```

### Phase 4: Updated GPT Handler with Tool Calling

**Update:** `chatbot-processor/lib/gpt-handler.js`

```javascript
async generateResponse(userMessage, conversationHistory = [], session = {}) {
  // ... existing setup ...

  // Step 5: Call OpenAI API WITH TOOLS
  const completion = await this.openai.chat.completions.create({
    model: GPT_CONFIG.model,
    messages,
    max_tokens: GPT_CONFIG.max_tokens,
    temperature: GPT_CONFIG.temperature,
    tools: CHATBOT_TOOLS,
    tool_choice: 'auto' // Let GPT decide when to use tools
  });

  const responseMessage = completion.choices[0]?.message;

  // Check if GPT wants to call a tool
  if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
    return await this.handleToolCalls(responseMessage, messages, session);
  }

  // Regular text response
  return responseMessage.content;
}

async handleToolCalls(responseMessage, messages, session) {
  const toolResults = [];

  for (const toolCall of responseMessage.tool_calls) {
    const functionName = toolCall.function.name;
    const args = JSON.parse(toolCall.function.arguments);

    let result;
    switch (functionName) {
      case 'check_availability':
        result = await this.smartAgenda.checkAvailability(
          args.center,
          args.treatment || 'tabaco',
          args.days_ahead || 14
        );
        break;

      case 'create_booking':
        result = await this.smartAgenda.createBooking(args);
        break;

      case 'get_center_info':
        result = this.getCenterInfo(args.center);
        break;
    }

    toolResults.push({
      tool_call_id: toolCall.id,
      role: 'tool',
      content: JSON.stringify(result)
    });
  }

  // Send tool results back to GPT for final response
  const finalMessages = [
    ...messages,
    responseMessage,
    ...toolResults
  ];

  const finalCompletion = await this.openai.chat.completions.create({
    model: GPT_CONFIG.model,
    messages: finalMessages,
    max_tokens: GPT_CONFIG.max_tokens,
    temperature: GPT_CONFIG.temperature
  });

  return finalCompletion.choices[0]?.message?.content;
}
```

### Phase 5: Updated System Prompt

```javascript
const SYSTEM_PROMPT_TEMPLATE = `Eres el asistente virtual de LaserOstop España...

## CAPACIDADES DE RESERVA

Puedes:
1. **Consultar disponibilidad** - Usa check_availability cuando el usuario quiera saber horarios
2. **Crear reservas** - Usa create_booking SOLO después de tener TODOS los datos confirmados
3. **Informar sobre centros** - Usa get_center_info para direcciones y contacto

## FLUJO DE RESERVA

Cuando alguien quiera reservar:
1. Pregunta qué centro prefiere (Barcelona, Sevilla, Madrid Chamartín, Atocha, Majadahonda, Torrejón)
2. Pregunta qué tratamiento (tabaco, cannabis, azúcar, o si vienen en pareja)
3. Consulta disponibilidad con check_availability
4. Presenta las opciones disponibles
5. Cuando elija horario, pide: nombre completo, email, teléfono
6. ANTES de crear la reserva, muestra un resumen y pide confirmación
7. Solo entonces usa create_booking

## REGLAS DE RESERVA

- NUNCA inventes horarios - usa SIEMPRE check_availability
- NUNCA crees reserva sin confirmación explícita del usuario
- Si no hay disponibilidad, ofrece otros centros o contacto WhatsApp
- Valida que el email tenga formato correcto
- Valida que el teléfono tenga al menos 9 dígitos

## MANEJO DE ERRORES

Si la reserva falla:
- Informa al usuario amablemente
- Ofrece alternativa: WhatsApp +34 689 560 130
- Guarda los datos para que el equipo les contacte

{KNOWLEDGE_BASE}
`;
```

---

## File Changes Summary

### New Files to Create

| File | Purpose |
|------|---------|
| `chatbot-processor/lib/smart-agenda-service.js` | API wrapper for Smart Agenda |
| `chatbot-processor/config/tools.js` | OpenAI function definitions |

### Files to Modify

| File | Changes |
|------|---------|
| `chatbot-processor/lib/gpt-handler.js` | Add tool calling, handleToolCalls() |
| `chatbot-processor/lib/message-processor.js` | Pass session to GPT, handle extended state |
| `chatbot-processor/lib/redis-client.js` | Support extended session structure |
| `chatbot-processor/config/prompts.js` | Updated system prompt with booking flow |
| `chatbot-processor/package.json` | No new dependencies needed |

### Environment Variables (Render.com)

Already exist in Netlify, need to add to Render:
```
SMART_AGENDA_LOGIN=eshapi48Kd79BmSy83A
SMART_AGENDA_PWD=f3be0da94b09f33ae362fa92a069508c50c67150
SMART_AGENDA_API_ID=app_landing
SMART_AGENDA_API_KEY=95Gt-Ke92-48Uf39Sp27hF
SMART_AGENDA_BASE_URL=https://www.smartagenda.fr/pro/laserostop-esh/api
```

---

## Conversation Flow Examples

### Example 1: Simple Availability Check

```
User: "¿Hay citas disponibles en Barcelona?"

[GPT calls check_availability(center="barcelona", treatment="tabaco")]

Bot: "Sí, tengo disponibilidad en Barcelona Sants:

📅 Viernes 27 dic: 10:00, 14:00, 15:00
📅 Lunes 30 dic: 09:00, 11:00, 12:00

¿Te gustaría reservar alguna de estas citas?"
```

### Example 2: Full Booking Flow

```
User: "Quiero reservar para dejar de fumar"

Bot: "¡Genial! ¿En qué centro te viene mejor?
- Barcelona Sants
- Sevilla
- Madrid (Chamartín, Atocha, Majadahonda, Torrejón)"

User: "Madrid Atocha"

Bot: "Perfecto, Atocha. ¿Vienes solo o en pareja?
(El tratamiento dúo tiene descuento)"

User: "Solo"

[GPT calls check_availability(center="atocha", treatment="tabaco")]

Bot: "Tengo disponibilidad en Madrid Atocha:

📅 Lunes 23 dic: 09:00, 11:00, 15:00
📅 Martes 24 dic: 10:00, 12:00

¿Cuál te viene mejor?"

User: "El lunes a las 11"

Bot: "Perfecto, lunes 23 de diciembre a las 11:00 en Atocha.

Para confirmar la reserva necesito:
- Tu nombre completo
- Email
- Teléfono de contacto"

User: "María García López, maria@email.com, 612345678"

Bot: "Gracias María. Confirmo los datos:

📍 Centro: Madrid Atocha
📅 Fecha: Lunes 23 diciembre, 11:00
💊 Tratamiento: Dejar de fumar (190€)
👤 Nombre: María García López
📧 Email: maria@email.com
📞 Teléfono: 612345678

¿Confirmo la reserva? (Sí/No)"

User: "Sí"

[GPT calls create_booking(...)]

Bot: "✅ ¡Reserva confirmada!

Recibirás un email de confirmación en maria@email.com.

📍 Madrid Atocha - Calle Canarias 26
📅 Lunes 23/12/2025 a las 11:00

Si necesitas cambiar algo: +34 689 560 130

¡Hasta pronto, María! 🙌"
```

### Example 3: No Availability

```
User: "¿Hay citas en Chamartín?"

[GPT calls check_availability(center="chamartin")]
[API returns empty]

Bot: "Lo siento, no hay disponibilidad en Madrid Chamartín en los próximos días 😕

¿Te gustaría que mire en otro centro de Madrid?
- Atocha
- Majadahonda
- Torrejón

O puedes contactar directamente: +34 689 560 130"
```

---

## Error Handling

### API Timeout
```javascript
try {
  const result = await this.smartAgenda.checkAvailability(...);
} catch (error) {
  if (error.message.includes('timeout')) {
    return {
      success: false,
      error: 'timeout',
      message: 'El sistema está tardando. Intenta de nuevo o contacta por WhatsApp.'
    };
  }
}
```

### Invalid User Data
```javascript
// In create_booking validation
if (!email.includes('@')) {
  return { success: false, error: 'invalid_email' };
}
if (phone.replace(/\D/g, '').length < 9) {
  return { success: false, error: 'invalid_phone' };
}
```

### Booking Failure
```javascript
// If Smart Agenda API fails
return {
  success: false,
  error: 'booking_failed',
  message: 'No se pudo crear la reserva. Tus datos han sido guardados.',
  fallback: 'Nuestro equipo te contactará. WhatsApp: +34 689 560 130'
};
```

---

## Testing Strategy

### Unit Tests
1. `smart-agenda-service.js` - Mock API responses
2. Tool calling flow - Mock OpenAI responses
3. Session state management - Redis mock

### Integration Tests
1. Full booking flow with test account
2. Error scenarios (no availability, API down)
3. Multi-turn conversation continuity

### Manual Testing
1. Test via admin dashboard chat tester
2. Test via WhatsApp (test number)
3. Edge cases: user abandons flow, invalid inputs

---

## Rollout Plan

### Phase 1: Development (2-3 days)
- [ ] Create smart-agenda-service.js
- [ ] Create tools.js
- [ ] Update gpt-handler.js
- [ ] Update prompts.js
- [ ] Local testing

### Phase 2: Testing (1-2 days)
- [ ] Deploy to Render staging
- [ ] Test via admin dashboard
- [ ] Test full booking flow
- [ ] Error scenario testing

### Phase 3: Soft Launch (1 week)
- [ ] Enable for WhatsApp only
- [ ] Monitor error rates
- [ ] Collect feedback
- [ ] Iterate on prompts

### Phase 4: Full Launch
- [ ] Enable for all platforms
- [ ] Monitor booking success rate
- [ ] Optimize prompts based on data

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Smart Agenda API slow | User frustration | Add timeout, fallback to WhatsApp |
| GPT hallucinates slots | Wrong bookings | Always use tool, never invent |
| Double booking | Angry customer | Check availability again before booking |
| User data collection fails | Lost booking | Save partial data, staff follow-up |
| Token costs spike | Budget overrun | Cache common queries, monitor daily |

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Booking completion rate | > 60% |
| Avg messages to book | < 8 |
| Error rate | < 5% |
| Fallback to human rate | < 10% |
| User satisfaction | > 4/5 stars |

---

## Cost Estimate

### Additional Costs

| Item | Estimate |
|------|----------|
| Extra GPT tokens (tool calls) | +$2-5/month |
| Smart Agenda API | Free (included) |
| Development time | 3-4 days |

### Break-even
If chatbot books 10+ appointments/month that would have been lost, ROI is positive.

---

## Next Steps

1. **Approve this plan**
2. Create `smart-agenda-service.js`
3. Create `tools.js`
4. Update `gpt-handler.js`
5. Update system prompt
6. Test locally
7. Deploy to Render staging
8. Full testing
9. Production deployment

---

**Ready to proceed with implementation?**
