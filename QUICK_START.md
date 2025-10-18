# Smart Cita - Quick Start Guide

## What's Ready

✅ Complete deployment structure created in `/mnt/d/LP-espagne/smart-cita-deployment/`

✅ Backend converted to Netlify Functions (serverless)

✅ Frontend configured for smart-cita.com deployment

✅ Multi-site structure supporting unlimited client sites

## Project Structure

```
smart-cita-deployment/
├── index.html                      # Smart Cita main landing page (root)
├── styles.css                      # Smart Cita styles
├── package.json                    # Netlify Functions dependencies
├── netlify.toml                    # Netlify configuration
├── netlify/functions/api.js        # Backend API (Smart Agenda integration)
├── laserostop_espagna/            # LaserOstop España booking system
└── DEPLOYMENT_GUIDE.md             # Full deployment instructions
```

## Deployment URLs

- `smart-cita.com/` → Smart Cita landing page
- `smart-cita.com/laserostop_espagna/` → LaserOstop España booking
- `smart-cita.com/api/*` → Backend API (Netlify Functions)

## Next Steps

### 1. Create GitHub Repository

```bash
cd /mnt/d/LP-espagne/smart-cita-deployment

# Create repo on GitHub.com first, then:
git remote add origin https://github.com/YOUR_USERNAME/smart-cita.git
git push -u origin main
```

### 2. Deploy to Netlify

1. Go to https://app.netlify.com/
2. **"Add new site"** → **"Import from GitHub"**
3. Select `smart-cita` repository
4. Build settings:
   - **Publish directory**: `.`
   - **Functions directory**: `netlify/functions`
5. Add environment variables:
   - `SMART_AGENDA_BASE_URL` = `https://www.smartagenda.fr`
   - `SMART_AGENDA_LOGIN` = (from client)
   - `SMART_AGENDA_PWD` = (from client)
   - `SMART_AGENDA_API_ID` = (from client)
   - `SMART_AGENDA_API_KEY` = (from client)
6. **Deploy site**

### 3. Configure Domain

**In Netlify:**
- Add custom domain: `smart-cita.com`
- Get nameservers or DNS records

**In Namecheap:**
- Go to Domain List → Manage `smart-cita.com`
- Update nameservers to Netlify's nameservers
- Wait 1-24 hours for DNS propagation

### 4. Enable HTTPS

- In Netlify: **Domain settings** → **HTTPS** → **Provision certificate**
- Enable **Force HTTPS**

## Testing

After DNS propagation, test:

1. `https://smart-cita.com/` - Main landing page
2. `https://smart-cita.com/laserostop_espagna/` - Booking system
3. `https://smart-cita.com/api/health` - API health check

## Important Files

- **DEPLOYMENT_GUIDE.md** - Complete step-by-step instructions
- **netlify.toml** - Routing configuration
- **netlify/functions/api.js** - All backend logic
- **package.json** - Dependencies

## Smart Agenda Credentials Needed

Get these from the client:

1. Smart Agenda login (email/username)
2. Smart Agenda password
3. Smart Agenda API ID
4. Smart Agenda API Key

These go in Netlify environment variables (NOT in code).

## Adding More Clients

To add another client site (e.g., `smart-cita.com/client_name/`):

```bash
mkdir client_name
# Add client files
git add .
git commit -m "Add client: client_name"
git push
```

Site will automatically deploy at `smart-cita.com/client_name/`

## Support

- Full guide: `DEPLOYMENT_GUIDE.md`
- Netlify docs: https://docs.netlify.com/
- DNS checker: https://dnschecker.org/

---

**Ready to deploy!** Follow the steps above or see DEPLOYMENT_GUIDE.md for detailed instructions.
