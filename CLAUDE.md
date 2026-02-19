# SmartCita / LaserOstop Project

## VPS Credentials
- **Provider:** Hostinger (KVM 2)
- **Hostname:** srv1261155.hstgr.cloud
- **IP:** 72.62.183.16
- **User:** root
- **Password:** Cod187267680@
- **Expires:** 2027-01-10

## SSH Access
```bash
ssh root@72.62.183.16
# or
ssh root@srv1261155.hstgr.cloud
```

## Deployed Services (PM2)
| Service             | Port  | Description                        |
|---------------------|-------|------------------------------------|
| laserostop-backend  | 3000  | Main backend API                   |
| chatbot-processor   | 10000 | AI chatbot processor               |
| webhook-server      | 10001 | Meta/WhatsApp webhook handler      |
| admin-server        | 10002 | Admin panel server                 |

## Domain & Nginx
- **Domain:** api.smart-cita.com (SSL via Let's Encrypt)
- `/api/` -> backend (port 3000)
- `/chatbot/` -> chatbot processor (port 10000)
- `/webhook` -> WhatsApp webhook (port 10001)
- `/admin` -> admin panel (port 10002)
- `/health` -> health check

## Project Location on VPS
- **Path:** /opt/laserostop/

## Deployment
- Code is managed via PM2
- Nginx reverse proxy in front
- Use `pm2 restart all` to restart services
- Use `pm2 logs` to view logs

## Tech Stack
- Node.js backend
- WhatsApp chatbot via Meta Business API
- Multiple city-specific frontend pages (Barcelona, Sevilla, Valencia, etc.)
- Smart Agenda API integration for appointments
