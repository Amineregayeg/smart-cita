# Smart Cita Deployment Guide

## Overview

This guide will help you deploy the Smart Cita multi-site platform to `smart-cita.com` with LaserOstop España as a subdirectory. Everything is deployed in ONE Netlify site using Netlify Functions for the backend.

## Architecture

```
smart-cita.com/
├── /                              → Smart Cita landing page
├── /laserostop_espagna/          → LaserOstop España booking system
├── /api/*                         → Netlify Functions (backend API)
└── /.netlify/functions/api        → Actual function endpoint
```

## URLs After Deployment

- **Main site**: `https://smart-cita.com/`
- **LaserOstop España**: `https://smart-cita.com/laserostop_espagna/`
- **API endpoint**: `https://smart-cita.com/api/*` (automatically routed to Netlify Functions)

---

## Step-by-Step Deployment

### Step 1: Create GitHub Repository

1. Go to [GitHub](https://github.com) and log in
2. Click **"New repository"** (or go to https://github.com/new)
3. Repository settings:
   - **Name**: `smart-cita`
   - **Description**: `Smart Cita - Calendar Integration Provider Platform`
   - **Visibility**: Private (recommended) or Public
   - **Do NOT** initialize with README (we already have one)
4. Click **"Create repository"**
5. Copy the repository URL

### Step 2: Push Code to GitHub

From `/mnt/d/LP-espagne/smart-cita-deployment` directory, run:

```bash
# Add GitHub as remote origin (replace YOUR_USERNAME with actual username)
git remote add origin https://github.com/YOUR_USERNAME/smart-cita.git

# Push to GitHub
git push -u origin main
```

### Step 3: Deploy to Netlify

1. Go to [Netlify](https://app.netlify.com/)
2. Click **"Add new site"** → **"Import an existing project"**
3. Choose **GitHub** and authorize Netlify
4. Select the `smart-cita` repository
5. Configure build settings:
   - **Base directory**: (leave empty - use root)
   - **Build command**: `echo 'Static site - no build required'`
   - **Publish directory**: `.`
   - **Functions directory**: `netlify/functions`

6. Click **"Show advanced"** → **"New variable"**

7. Add environment variables:
   - `SMART_AGENDA_BASE_URL` = `https://www.smartagenda.fr`
   - `SMART_AGENDA_LOGIN` = (get from client)
   - `SMART_AGENDA_PWD` = (get from client)
   - `SMART_AGENDA_API_ID` = (get from client)
   - `SMART_AGENDA_API_KEY` = (get from client)

8. Click **"Deploy site"**

9. Wait for deployment to complete (usually 1-2 minutes)

### Step 4: Configure Custom Domain on Netlify

1. In Netlify, go to **Site settings** → **Domain management**
2. Click **"Add custom domain"**
3. Enter: `smart-cita.com`
4. Click **"Verify"** then **"Add domain"**
5. Also add `www.smart-cita.com` as an alias
6. Netlify will show you DNS configuration options

### Step 5: Configure Namecheap DNS

#### Recommended Method: Use Netlify DNS (Easier & Automatic)

1. Log in to [Namecheap](https://www.namecheap.com/)
2. Go to **Domain List** → Click **Manage** next to `smart-cita.com`
3. Find **Nameservers** section
4. Select **"Custom DNS"**
5. Enter Netlify's nameservers (shown in Netlify dashboard):
   - `dns1.p01.nsone.net`
   - `dns2.p01.nsone.net`
   - `dns3.p01.nsone.net`
   - `dns4.p01.nsone.net`
6. Click **Save** (green checkmark icon)
7. Wait 1-24 hours for DNS propagation (usually 1-2 hours)

#### Alternative Method: Manual DNS Configuration

1. Log in to [Namecheap](https://www.namecheap.com/)
2. Go to **Domain List** → Click **Manage** next to `smart-cita.com`
3. Go to **Advanced DNS** tab
4. Add these DNS records:

   **A Record:**
   - **Type**: A Record
   - **Host**: `@`
   - **Value**: `75.2.60.5` (Netlify's load balancer)
   - **TTL**: Automatic

   **CNAME Record:**
   - **Type**: CNAME Record
   - **Host**: `www`
   - **Value**: `YOUR-SITE-NAME.netlify.app` (get from Netlify)
   - **TTL**: Automatic

5. Remove any existing conflicting records
6. Click **"Save all changes"**
7. Wait 1-24 hours for DNS propagation

### Step 6: Enable HTTPS

1. In Netlify, go to **Site settings** → **Domain management** → **HTTPS**
2. Click **"Verify DNS configuration"**
3. Once DNS is verified, click **"Provision certificate"**
4. Netlify will automatically provision a free SSL certificate from Let's Encrypt
5. Enable **"Force HTTPS"** to redirect all HTTP traffic to HTTPS

### Step 7: Test the Deployment

Check DNS propagation: https://dnschecker.org/?query=smart-cita.com

Once propagated, test:

1. **Main site**: Visit `https://smart-cita.com/`
   - Should show Smart Cita landing page

2. **LaserOstop España**: Visit `https://smart-cita.com/laserostop_espagna/`
   - Should show booking page with hero section and form

3. **API Health Check**: Visit `https://smart-cita.com/api/health`
   - Should return JSON: `{"status":"healthy","timestamp":"...","service":"smart-agenda-api"}`

4. **Test Booking Flow**:
   - Select a center
   - Choose appointment type
   - Select date/time
   - Fill in client details
   - Submit booking
   - Verify booking appears in Smart Agenda dashboard

### Step 8: Verify Netlify Functions

1. In Netlify dashboard, go to **Functions** tab
2. You should see `api` function listed
3. Click on it to see:
   - Function logs
   - Invocation count
   - Error rate
   - Recent requests

---

## How It Works

### Frontend to Backend Communication

1. Frontend makes API call: `fetch('/api/booking', {...})`
2. Netlify redirects `/api/*` to `/.netlify/functions/api/*` (via `netlify.toml`)
3. Netlify Function executes and calls Smart Agenda API
4. Response returned to frontend

### File Structure

```
smart-cita-deployment/
├── index.html                    # Smart Cita main page
├── styles.css                    # Smart Cita styles
├── package.json                  # Dependencies for Netlify Functions
├── netlify.toml                  # Netlify configuration
├── netlify/
│   └── functions/
│       └── api.js               # Backend API as Netlify Function
└── laserostop_espagna/
    ├── index.html               # Booking page
    ├── assets/                  # Images
    └── backend/                 # Original backend (for reference only)
```

### Netlify Functions Endpoints

All accessible via `/api/*`:

- `GET /api/centers` - List all centers
- `GET /api/appointment-types?centerId=X` - Get appointment types
- `GET /api/availability?...` - Get availability (currently disabled)
- `POST /api/booking` - Create booking
- `GET /api/health` - Health check

---

## Troubleshooting

### DNS Not Propagating

- Check status: https://dnschecker.org/?query=smart-cita.com
- Usually takes 1-2 hours, max 48 hours
- Clear browser/DNS cache:
  - **Windows**: `ipconfig /flushdns`
  - **Mac**: `sudo dscacheutil -flushcache`
  - **Linux**: `sudo systemd-resolve --flush-caches`

### Function Not Working

1. Check Netlify **Functions** tab for errors
2. Verify environment variables are set
3. Check function logs for errors
4. Test with: `curl https://smart-cita.com/api/health`

### HTTPS Certificate Issues

- DNS must be fully propagated first
- Wait 24 hours after DNS changes
- Try **"Provision certificate"** again
- Contact Netlify support if still failing

### 404 Errors

- Check `netlify.toml` is in root directory
- Verify redirects are configured correctly
- Check Netlify deploy logs

### CORS Errors

- Netlify Functions automatically handle CORS
- Check browser console for specific error
- Verify `Access-Control-Allow-Origin: *` header is set

---

## Making Updates

### Update Frontend

1. Edit files locally
2. Commit and push:
   ```bash
   git add .
   git commit -m "Update frontend"
   git push
   ```
3. Netlify automatically deploys in ~1 minute

### Update Backend (Netlify Function)

1. Edit `netlify/functions/api.js`
2. Commit and push:
   ```bash
   git add .
   git commit -m "Update API function"
   git push
   ```
3. Netlify automatically redeploys

### Update Environment Variables

1. Go to Netlify dashboard
2. **Site settings** → **Environment variables**
3. Update values
4. **Trigger deploy** for changes to take effect

---

## Adding More Client Sites

To add additional clients under `smart-cita.com/client_name/`:

1. Create directory:
   ```bash
   mkdir -p client_name
   ```

2. Add client files to that directory

3. (Optional) Update `netlify.toml` if special routing needed:
   ```toml
   [[redirects]]
     from = "/client_name"
     to = "/client_name/index.html"
     status = 200
   ```

4. Commit and push:
   ```bash
   git add .
   git commit -m "Add client: client_name"
   git push
   ```

5. Live at: `https://smart-cita.com/client_name/`

---

## Monitoring & Maintenance

### Netlify Dashboard

- **Deploys**: View deployment history and logs
- **Functions**: Monitor API usage and errors
- **Analytics**: Track site traffic (if enabled)
- **Logs**: Real-time function logs

### Smart Agenda Dashboard

- Log in to verify bookings appear
- Check client records are created
- Verify appointment details are correct

---

## Cost Estimate

### Netlify Free Tier Includes:

- ✅ 100 GB bandwidth/month
- ✅ 300 build minutes/month
- ✅ 125K function invocations/month
- ✅ Unlimited sites
- ✅ Free SSL certificates
- ✅ DDoS protection

**For this project**: Should stay well within free tier limits.

### If You Need More:

- **Netlify Pro**: $19/month
  - 400 GB bandwidth
  - 2M function invocations
  - Background functions
  - Analytics

---

## Support Resources

- **Netlify Docs**: https://docs.netlify.com/
- **Netlify Functions**: https://docs.netlify.com/functions/overview/
- **Namecheap Support**: https://www.namecheap.com/support/
- **DNS Checker**: https://dnschecker.org/
- **SSL Checker**: https://www.sslshopper.com/ssl-checker.html

---

## Deployment Checklist

- [ ] GitHub repository created
- [ ] Code pushed to GitHub
- [ ] Netlify site created and connected to GitHub
- [ ] Environment variables configured in Netlify
- [ ] Initial deployment successful
- [ ] Functions deployed and working (`/api/health` returns 200)
- [ ] Custom domain `smart-cita.com` added in Netlify
- [ ] DNS configured in Namecheap (nameservers or A/CNAME records)
- [ ] DNS propagated (check with dnschecker.org)
- [ ] HTTPS certificate provisioned
- [ ] Force HTTPS enabled
- [ ] Main site accessible (`smart-cita.com`)
- [ ] LaserOstop site accessible (`smart-cita.com/laserostop_espagna/`)
- [ ] API endpoints working (test `/api/health`)
- [ ] Booking flow tested end-to-end
- [ ] Bookings appear in Smart Agenda dashboard

---

**Created**: 2025-10-18
**Last Updated**: 2025-10-18
**Version**: 2.0 (Netlify Functions)
