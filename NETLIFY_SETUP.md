# Netlify Deployment - Next Steps

## ✅ GitHub Repository Setup Complete

**Repository**: https://github.com/Amineregayeg/smart-cita

The code has been successfully pushed to GitHub and is ready for Netlify deployment.

---

## 🚀 Deploy to Netlify

### Step 1: Create Netlify Account (if needed)

Go to https://app.netlify.com/ and sign up or log in.

### Step 2: Import from GitHub

1. Click **"Add new site"** → **"Import an existing project"**
2. Choose **"GitHub"**
3. Authorize Netlify to access your GitHub account
4. Select repository: **Amineregayeg/smart-cita**

### Step 3: Configure Build Settings

In the build settings screen, configure:

- **Branch to deploy**: `main`
- **Base directory**: (leave empty)
- **Build command**: `echo 'Static site - no build required'`
- **Publish directory**: `.`
- **Functions directory**: `netlify/functions`

### Step 4: Add Environment Variables

Click **"Show advanced"** → **"New variable"** and add these 5 variables:

| Variable Name | Value | Where to Get It |
|--------------|-------|----------------|
| `SMART_AGENDA_BASE_URL` | `https://www.smartagenda.fr` | (fixed value) |
| `SMART_AGENDA_LOGIN` | (get from client) | Smart Agenda account email/username |
| `SMART_AGENDA_PWD` | (get from client) | Smart Agenda account password |
| `SMART_AGENDA_API_ID` | (get from client) | Smart Agenda API credentials |
| `SMART_AGENDA_API_KEY` | (get from client) | Smart Agenda API credentials |

**Important**: These must be set before deployment for the API to work.

### Step 5: Deploy

1. Click **"Deploy site"**
2. Wait 1-2 minutes for deployment to complete
3. You'll get a temporary URL like: `https://random-name-123.netlify.app`

### Step 6: Test the Deployment

Once deployed, test:

1. Visit the Netlify URL (e.g., `https://random-name-123.netlify.app`)
   - Should show Smart Cita landing page

2. Visit `/laserostop_espagna/`
   - Should show LaserOstop booking page

3. Visit `/api/health`
   - Should return: `{"status":"healthy","timestamp":"...","service":"smart-agenda-api"}`

4. Test a booking:
   - Select center
   - Choose appointment type
   - Fill in details
   - Submit
   - Check Smart Agenda dashboard for the booking

---

## 🌐 Configure Custom Domain

### Step 7: Add Domain in Netlify

1. In Netlify, go to **Site settings** → **Domain management**
2. Click **"Add custom domain"**
3. Enter: `smart-cita.com`
4. Click **"Verify"** then **"Add domain"**
5. Also add: `www.smart-cita.com` as an alias

Netlify will provide DNS configuration options.

### Step 8: Configure Namecheap DNS

You have two options:

#### Option A: Netlify DNS (Recommended - Easier)

1. In Netlify, note the 4 nameservers (e.g., `dns1.p01.nsone.net`)
2. Log in to Namecheap: https://www.namecheap.com/
3. Go to **Domain List** → **Manage** next to `smart-cita.com`
4. Find **Nameservers** section
5. Select **"Custom DNS"**
6. Enter the 4 Netlify nameservers
7. Click **Save** (green checkmark)
8. Wait 1-24 hours for DNS propagation

#### Option B: Manual DNS Configuration

1. Log in to Namecheap: https://www.namecheap.com/
2. Go to **Domain List** → **Manage** next to `smart-cita.com`
3. Go to **Advanced DNS** tab
4. Add these records:

**A Record:**
- Type: A Record
- Host: `@`
- Value: `75.2.60.5` (Netlify load balancer)
- TTL: Automatic

**CNAME Record:**
- Type: CNAME Record
- Host: `www`
- Value: `YOUR-SITE-NAME.netlify.app` (from Netlify)
- TTL: Automatic

5. Remove any conflicting records
6. Click **"Save all changes"**
7. Wait 1-24 hours for DNS propagation

### Step 9: Enable HTTPS

1. Check DNS propagation: https://dnschecker.org/?query=smart-cita.com
2. Once DNS is propagated, go to Netlify: **Domain settings** → **HTTPS**
3. Click **"Verify DNS configuration"**
4. Click **"Provision certificate"** (free Let's Encrypt SSL)
5. Enable **"Force HTTPS"**

---

## 🧪 Final Testing

Once DNS is fully propagated and HTTPS is enabled:

### Test URLs:

1. **https://smart-cita.com/** → Smart Cita landing page ✓
2. **https://smart-cita.com/laserostop_espagna/** → Booking page ✓
3. **https://smart-cita.com/api/health** → API health check ✓
4. **https://www.smart-cita.com/** → Should redirect to main domain ✓

### Test Booking Flow:

1. Go to https://smart-cita.com/laserostop_espagna/
2. Select a center (e.g., Valencia)
3. Choose appointment type
4. Select date and time
5. Fill in client details:
   - First name: Test
   - Last name: User
   - Email: test@example.com
   - Phone: +34 600 000 000
6. Submit booking
7. Verify success message
8. Check Smart Agenda dashboard for the new booking

---

## 📊 Monitor & Maintain

### Netlify Dashboard

- **Deploys**: View deployment history and logs
- **Functions**: Monitor API calls, view logs, check errors
- **Analytics**: Enable to track traffic (optional, paid feature)

### Making Updates

Any push to the `main` branch on GitHub will automatically trigger a new deployment on Netlify.

To update:
```bash
cd /mnt/d/LP-espagne/smart-cita-deployment
# Make your changes
git add .
git commit -m "Your update message"
git push
```

Netlify will automatically deploy in ~1 minute.

---

## 🔧 Troubleshooting

### Functions Not Working

1. Go to Netlify → **Functions** tab
2. Click on `api` function
3. Check logs for errors
4. Verify environment variables are set correctly
5. Test endpoint: `curl https://smart-cita.com/api/health`

### DNS Not Propagating

- Check: https://dnschecker.org/?query=smart-cita.com
- Usually takes 1-2 hours
- Max 48 hours
- Clear local DNS cache:
  - Windows: `ipconfig /flushdns`
  - Mac: `sudo dscacheutil -flushcache`

### SSL Certificate Issues

- DNS must be fully propagated first
- Wait 24 hours after DNS changes
- Try provisioning certificate again
- Contact Netlify support if still failing

---

## 📝 Environment Variables Reference

These Smart Agenda credentials are needed (get from client):

```
SMART_AGENDA_BASE_URL=https://www.smartagenda.fr
SMART_AGENDA_LOGIN=<client's Smart Agenda email>
SMART_AGENDA_PWD=<client's Smart Agenda password>
SMART_AGENDA_API_ID=<from Smart Agenda API settings>
SMART_AGENDA_API_KEY=<from Smart Agenda API settings>
```

To find API credentials in Smart Agenda:
1. Log in to Smart Agenda dashboard
2. Go to **Settings** → **API**
3. Copy API ID and API Key

---

## ✅ Deployment Checklist

- [ ] Netlify account created/logged in
- [ ] GitHub repository connected to Netlify
- [ ] Build settings configured
- [ ] Environment variables added (5 variables)
- [ ] Site deployed successfully
- [ ] Temporary URL tested and working
- [ ] Functions deployed (check Functions tab)
- [ ] API health endpoint working
- [ ] Custom domain `smart-cita.com` added
- [ ] DNS configured in Namecheap
- [ ] DNS propagated (checked with dnschecker.org)
- [ ] HTTPS certificate provisioned
- [ ] Force HTTPS enabled
- [ ] smart-cita.com accessible
- [ ] /laserostop_espagna/ accessible
- [ ] Booking flow tested end-to-end
- [ ] Booking appears in Smart Agenda

---

**Repository**: https://github.com/Amineregayeg/smart-cita

**Next**: Follow Steps 1-9 above to complete deployment!
