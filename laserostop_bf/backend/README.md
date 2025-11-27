# LaserOstop Backend API

Backend API proxy for LaserOstop España landing page - Smart Agenda integration.

## Quick Start

```bash
# Install dependencies
npm install

# Create .env file (copy from .env.example)
cp .env.example .env
# Edit .env with your credentials

# Start server
npm start

# Development mode (auto-restart)
npm run dev
```

## Environment Variables

Required environment variables (create `.env` file):

```env
SMART_AGENDA_BASE_URL=https://www.smartagenda.fr/pro/laserostop-esh-dev/api
SMART_AGENDA_LOGIN=your_login
SMART_AGENDA_PWD=your_password
SMART_AGENDA_API_ID=your_api_id
SMART_AGENDA_API_KEY=your_api_key
NODE_ENV=production
PORT=3000
CORS_ORIGIN=*
```

## API Endpoints

- `GET /api/health` - Health check
- `GET /api/centers` - Get all centers
- `GET /api/appointment-types?centerId=1` - Get appointment types
- `GET /api/availability?startDate=2025-10-20&endDate=2025-10-27` - Get availability
- `POST /api/booking` - Create booking

## Deployment

See `/lp_code/DEPLOYMENT.md` for full deployment instructions.

### Deploy to Render.com

1. Connect GitHub repo
2. Set root directory to `lp_code/backend`
3. Build: `npm install`
4. Start: `npm start`
5. Add environment variables from `.env`

## License

Internal use - LaserOstop España
