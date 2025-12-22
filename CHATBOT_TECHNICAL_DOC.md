# LaserOstop España - Chatbot Technical Documentation

**Last Updated:** December 22, 2025
**Status:** Admin Dashboard Complete | WhatsApp/Meta Integration Pending

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Admin Dashboard](#admin-dashboard)
4. [Chatbot Configuration](#chatbot-configuration)
5. [Environment Variables](#environment-variables)
6. [API Endpoints](#api-endpoints)
7. [WhatsApp/Meta Integration (Pending)](#whatsappmeta-integration-pending)
8. [File Structure](#file-structure)
9. [Deployment](#deployment)
10. [Costs](#costs)

---

## Overview

A Spanish-speaking AI chatbot for LaserOstop España that:
- Answers customer questions about laser treatments for quitting smoking, cannabis, and sugar addiction
- Provides pricing, location, and booking information
- Will integrate with WhatsApp Business, Facebook Messenger, and Instagram DM

**Technology Stack:**
- **LLM:** OpenAI GPT-4o-mini
- **Backend:** Netlify Functions (serverless)
- **Session Storage:** Upstash Redis
- **Frontend:** Vanilla JavaScript + Tailwind CSS
- **Deployment:** Netlify (auto-deploy from GitHub)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        ADMIN DASHBOARD                          │
│                  https://smart-cita.com/admin                   │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  Analytics   │  │Conversations │  │ Chat Tester  │          │
│  │   Tab        │  │    Tab       │  │    Tab       │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     NETLIFY FUNCTIONS                           │
├─────────────────────────────────────────────────────────────────┤
│  /api/admin-auth         → Password authentication              │
│  /api/admin-stats        → Dashboard analytics                  │
│  /api/admin-conversations → Conversation logs                   │
│  /api/admin-test-chat    → Direct GPT testing                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      EXTERNAL SERVICES                          │
├─────────────────────────────────────────────────────────────────┤
│  Upstash Redis    → Session storage, stats, conversation logs   │
│  OpenAI API       → GPT-4o-mini for chat responses              │
└─────────────────────────────────────────────────────────────────┘
```

### Future Architecture (WhatsApp/Meta)

```
WhatsApp/Meta → Netlify Webhooks → Redis Queue → Render Worker → GPT → Response
```

---

## Admin Dashboard

**URL:** https://smart-cita.com/admin

### Authentication

- **Method:** SHA-256 password hash comparison
- **Session:** Token stored in Redis (24h TTL) + localStorage
- **Rate Limiting:** 5 failed attempts → 1 minute lockout

### Features

#### 1. Analytics Tab
- Messages today / total
- Token usage & cost
- Average response time
- Platform breakdown (WhatsApp/Messenger/Instagram)
- 7-day charts (messages & tokens)
- Auto-refresh every 30 seconds

#### 2. Conversations Tab
- Paginated conversation logs
- Search by message content
- Filter by platform
- Shows: timestamp, platform, user ID, messages, tokens, response time

#### 3. Chat Tester Tab
- Direct chatbot testing without WhatsApp/Meta
- Shows token usage and response time per message
- Clear chat button

### Files

| File | Purpose |
|------|---------|
| `laserostop_bf/admin.html` | Dashboard UI |
| `laserostop_bf/admin.js` | Dashboard logic |
| `netlify/functions/admin-auth.js` | Login endpoint |
| `netlify/functions/admin-stats.js` | Analytics endpoint |
| `netlify/functions/admin-conversations.js` | Logs endpoint |
| `netlify/functions/admin-test-chat.js` | Chat test endpoint |

---

## Chatbot Configuration

### System Prompt

Located in: `netlify/functions/admin-test-chat.js`

```
Eres el asistente virtual de LaserOstop España...

IDENTIDAD:
- Profesional pero cercano y empático
- Hablas SOLO en español de España
- Entiendes que dejar una adicción es difícil

TONO:
- Cálido pero CONCISO - respuestas cortas y directas
- Varía tus respuestas, no empieces siempre igual
- Máximo 1 emoji por respuesta
- NO repitas información innecesariamente

INFORMACIÓN CLAVE:
- Tratamiento individual tabaco: 170€ online / 190€ centro
- Tratamiento dúo (2 personas): 340€ online / 360€ centro
- Cannabis: 230€ online / 250€ centro
- Azúcar: 180€ online / 200€ centro
- Sesión recaída: GRATIS durante 1 año
- Duración sesión: 60-90 minutos, normalmente 1 sesión
- Tasa éxito: aproximadamente 80%

CENTROS:
- Barcelona Sants
- Madrid: Atocha, Chamartín, Majadahonda, Torrejón
- Sevilla

Web reservas: https://smart-cita.com/laserostop_bf/
WhatsApp: +34 689 560 130

REGLAS ESTRICTAS:
1. Respuestas de MÁXIMO 2 párrafos cortos (60-80 palabras total)
2. NO incluir CTA de reserva en CADA mensaje
3. NO dar consejos médicos - derivar a su médico o WhatsApp
4. NO prometer resultados 100% garantizados
5. Si preguntan algo médico específico: derivar a médico/WhatsApp
6. Sé directo: responde la pregunta primero
```

### GPT Settings

| Setting | Value |
|---------|-------|
| Model | gpt-4o-mini |
| Max tokens | 150 |
| Temperature | 0.7 |

### Response Characteristics

- **Length:** 60-80 words (2 short paragraphs max)
- **Tone:** Warm but concise
- **Emojis:** Max 1 per response
- **CTA:** Only when asking about prices/booking
- **Medical questions:** Refer to doctor or WhatsApp

---

## Environment Variables

### Required (Netlify Dashboard)

| Variable | Description | Example |
|----------|-------------|---------|
| `UPSTASH_REDIS_URL` | Redis connection string | `rediss://default:xxx@xxx.upstash.io:6379` |
| `OPENAI_API_KEY` | OpenAI API key | `sk-proj-xxx` |
| `ADMIN_PASSWORD_HASH` | SHA-256 hash of admin password | `6e659dea...` |

### Generate Password Hash

```bash
echo -n "yourpassword" | sha256sum | cut -d' ' -f1
```

### Future (WhatsApp/Meta)

| Variable | Description |
|----------|-------------|
| `WHATSAPP_VERIFY_TOKEN` | Webhook verification token |
| `WHATSAPP_APP_SECRET` | For signature verification |
| `WHATSAPP_ACCESS_TOKEN` | API access token |
| `WHATSAPP_PHONE_NUMBER_ID` | Phone number ID |
| `META_VERIFY_TOKEN` | Meta webhook verification |
| `META_APP_SECRET` | Meta app secret |
| `META_PAGE_ACCESS_TOKEN` | Facebook page token |

---

## API Endpoints

### POST /api/admin-auth

Authenticate admin user.

**Request:**
```json
{
  "passwordHash": "sha256_hash_of_password"
}
```

**Response (success):**
```json
{
  "success": true,
  "token": "random_64_char_token",
  "expiresAt": "2025-12-23T12:00:00Z"
}
```

**Response (error):**
```json
{
  "success": false,
  "error": "Contrasena incorrecta"
}
```

### GET /api/admin-stats

Get dashboard analytics. Requires `Authorization: Bearer <token>`.

**Response:**
```json
{
  "messagesToday": 142,
  "messagesTotal": 5420,
  "tokensToday": 34500,
  "costToday": 0.42,
  "avgResponseTime": 1850,
  "dailyMessages": [
    { "date": "2025-12-15", "count": 120 }
  ],
  "platformBreakdown": {
    "whatsapp": 3200,
    "messenger": 1800,
    "instagram": 420
  },
  "dailyTokens": [
    { "date": "2025-12-15", "tokens": 45000 }
  ]
}
```

### GET /api/admin-conversations

Get conversation logs. Requires `Authorization: Bearer <token>`.

**Query params:** `page`, `limit`, `platform`, `search`

**Response:**
```json
{
  "conversations": [
    {
      "id": "uuid",
      "timestamp": "2025-12-21T10:30:00Z",
      "platform": "whatsapp",
      "userId": "...1234",
      "userMessage": "Cuanto cuesta?",
      "botResponse": "El tratamiento...",
      "tokens": 245,
      "responseTime": 1234
    }
  ],
  "total": 1000,
  "page": 1,
  "pages": 50
}
```

### POST /api/admin-test-chat

Test chatbot directly. Requires `Authorization: Bearer <token>`.

**Request:**
```json
{
  "message": "Cuanto cuesta el tratamiento?"
}
```

**Response:**
```json
{
  "response": "El tratamiento individual...",
  "tokens": 180,
  "responseTime": 1456
}
```

---

## WhatsApp/Meta Integration (Pending)

### Required from Community Manager

**WhatsApp:**
- Meta Business Account ID
- WhatsApp Business Account ID
- Phone Number ID (for +34 689 560 130)
- Permanent Access Token (System User token)
- App Secret

**Facebook:**
- Facebook Page ID
- Page Access Token
- App ID & App Secret

**Instagram:**
- Instagram Business Account ID
- Confirm connected to Facebook page

### Webhook URLs (to configure)

| Platform | URL |
|----------|-----|
| WhatsApp | `https://smart-cita.com/webhook/whatsapp` |
| Meta (FB/IG) | `https://smart-cita.com/webhook/meta` |

### Files to Create

| File | Purpose |
|------|---------|
| `netlify/functions/webhook-whatsapp.js` | WhatsApp webhook receiver |
| `netlify/functions/webhook-meta.js` | Facebook/Instagram receiver |

---

## File Structure

```
smart-cita-deployment/
├── laserostop_bf/
│   ├── admin.html              # Admin dashboard UI
│   ├── admin.js                # Dashboard JavaScript
│   └── index.html              # Main booking page
├── netlify/
│   └── functions/
│       ├── admin-auth.js       # Login endpoint
│       ├── admin-stats.js      # Analytics endpoint
│       ├── admin-conversations.js  # Logs endpoint
│       ├── admin-test-chat.js  # Chat testing endpoint
│       ├── redis-test.js       # Debug endpoint (can remove)
│       └── shared/
│           └── redis-client.js # Redis connection utilities
├── netlify.toml                # Netlify configuration
├── package.json                # Dependencies (ioredis)
└── CHATBOT_TECHNICAL_DOC.md    # This document
```

---

## Deployment

### Auto-Deploy

Push to `main` branch on GitHub triggers Netlify deploy automatically.

```bash
git add .
git commit -m "your message"
git push origin main
```

### Manual Deploy

Netlify Dashboard → Deploys → Trigger deploy

### Environment Variables

Must be set in Netlify Dashboard → Site settings → Environment variables

**Important:** After adding/changing env vars, trigger a new deploy.

---

## Costs

### Current (Admin Dashboard Only)

| Service | Monthly Cost |
|---------|--------------|
| OpenAI GPT-4o-mini | ~$5-10 (testing) |
| Upstash Redis | $0 (free tier) |
| Netlify | $0 (free tier) |
| **Total** | **~$5-10** |

### Projected (50,000 messages/month)

| Service | Monthly Cost |
|---------|--------------|
| OpenAI GPT-4o-mini | ~$4 |
| Upstash Redis | $0 (free tier) |
| Netlify Functions | $0 (free tier) |
| WhatsApp API | $45-80 |
| Meta Messenger/Instagram | $0 |
| **Total** | **~$50-85** |

---

## Redis Keys

| Key Pattern | Purpose | TTL |
|-------------|---------|-----|
| `admin:session:{token}` | Admin session token | 24h |
| `chatbot:stats:messages:total` | Total message counter | - |
| `chatbot:stats:messages:{date}` | Daily message counter | 7d |
| `chatbot:stats:tokens:{date}` | Daily token usage | 7d |
| `chatbot:stats:platform:{name}` | Platform counters | - |
| `chatbot:logs:recent` | Recent conversation logs | - |
| `chatbot:processed:{messageId}` | Idempotency tracking | 24h |
| `chatbot:ratelimit:{platform}:{userId}` | Rate limiting | 1m |
| `chatbot:session:{platform}:{userId}` | User session context | 24h |

---

## Security

- **Password:** SHA-256 hashed, timing-safe comparison
- **Sessions:** Random 64-char tokens, 24h expiry
- **Rate Limiting:** 5 failed logins → 1 minute lockout
- **Webhooks (future):** HMAC SHA-256 signature verification
- **Redis:** TLS connection (rediss://)
- **CORS:** Configured in netlify.toml

---

## Troubleshooting

### "Error del servidor - Redis no configurado"
→ Check `UPSTASH_REDIS_URL` in Netlify env vars, trigger redeploy

### 401 Unauthorized on dashboard
→ Session expired or invalid. Clear localStorage and re-login.

### Chat responses too long/short
→ Adjust `max_tokens` in admin-test-chat.js (currently 150)

### Styles not loading (white on white)
→ Tailwind classes may not be in generated CSS. Use inline styles.

---

## Next Steps

1. [ ] Get WhatsApp/Meta API credentials from CM
2. [ ] Create webhook functions
3. [ ] Set up Render.com worker for message processing
4. [ ] Configure webhooks in Meta Business Suite
5. [ ] Test end-to-end flow
6. [ ] Remove redis-test.js debug endpoint
7. [ ] Production launch

---

**Repository:** https://github.com/Amineregayeg/smart-cita
**Live Site:** https://smart-cita.com
**Admin Dashboard:** https://smart-cita.com/admin
