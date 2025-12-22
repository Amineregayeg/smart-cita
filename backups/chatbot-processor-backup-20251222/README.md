# LaserOstop Chatbot Processor

Background worker for the LaserOstop España community manager chatbot. Processes incoming messages from WhatsApp and Meta (Facebook/Instagram) platforms using GPT-5 Nano.

## Architecture

```
WhatsApp/Meta → Netlify Webhooks → Redis Queue → This Processor → GPT-5 Nano → Response
```

## Setup

### 1. Prerequisites

- Node.js 18+
- Upstash Redis account
- OpenAI API key
- WhatsApp Business API access
- Meta Developer App (for FB/IG)

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

Required environment variables:
- `UPSTASH_REDIS_URL` - Redis connection string
- `OPENAI_API_KEY` - OpenAI API key
- `WHATSAPP_ACCESS_TOKEN` - WhatsApp Cloud API token
- `WHATSAPP_PHONE_NUMBER_ID` - WhatsApp phone number ID
- `META_PAGE_ACCESS_TOKEN` - Facebook Page access token
- `META_INSTAGRAM_ACCESS_TOKEN` - Instagram access token (optional)

### 4. Run Locally

```bash
# Development with auto-reload
npm run dev

# Production
npm start
```

## Deployment (Render.com)

1. Create a new **Background Worker** on Render
2. Connect this repository
3. Set build command: `npm install`
4. Set start command: `node server.js`
5. Add environment variables in Render dashboard
6. Deploy

## Files Structure

```
chatbot-processor/
├── server.js                    # Main worker (polls Redis queue)
├── lib/
│   ├── redis-client.js         # Redis connection & utilities
│   ├── message-processor.js    # Message orchestration
│   ├── gpt-handler.js          # GPT-5 Nano integration
│   ├── knowledge-loader.js     # Knowledge base management
│   └── platform-adapters/
│       ├── whatsapp-adapter.js # WhatsApp API
│       └── meta-adapter.js     # Facebook/Instagram API
├── config/
│   └── prompts.js              # System prompts & GPT config
├── data/
│   └── CHATBOT_KNOWLEDGE_BASE.md  # Business knowledge
└── package.json
```

## How It Works

1. **Webhooks** (on Netlify) receive incoming messages
2. Messages are **validated** (signature, timestamp, rate limit)
3. Valid messages are **queued** in Redis
4. This **processor** polls the queue continuously
5. For each message:
   - Load conversation context (session)
   - Extract relevant knowledge base sections
   - Generate response with GPT-5 Nano
   - Send response via platform API
   - Update session context

## Token Optimization

- Knowledge base chunking (300-500 tokens vs 2000+)
- Response caching for common questions
- Conversation history limited to 6 messages
- Max response length: 150 tokens

## Monitoring

Check Redis for metrics:
```
chatbot:gpt:tokens:YYYY-MM-DD  # Daily token usage
chatbot:messages:queue         # Queue depth
chatbot:session:*              # Active sessions
```

## Cost Estimate

For 50,000 messages/month:
- GPT-5 Nano: ~$4
- Infrastructure (free tiers): $0
- WhatsApp conversations: $45-80

Total: ~$50-85/month

## Support

WhatsApp: +34 689 560 130
