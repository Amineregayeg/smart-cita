# 🚀 Deploy LaserOstop España NOW

## ✅ GitHub Repository Created!

**Repository URL:** https://github.com/Amineregayeg/laserostop-espana

Code is pushed and ready to deploy!

---

## Step 1: Deploy Backend to Render.com (15 minutes)

### 1. Go to Render.com
- Open: https://render.com
- Click "Get Started" or "Sign In"
- Sign up with your GitHub account (Amineregayeg)

### 2. Create New Web Service
- Click "New +" button (top right)
- Select "Web Service"
- Click "Connect account" to connect GitHub
- Select repository: **laserostop-espana**

### 3. Configure Service
Fill in these settings:

```
Name: laserostop-backend
Region: Frankfurt (or closest to Spain)
Branch: main
Root Directory: backend
Runtime: Node
Build Command: npm install
Start Command: npm start
Instance Type: Free
```

### 4. Add Environment Variables

Click "Advanced" → "Add Environment Variable"

Add these **6 variables** (copy exactly):

```
SMART_AGENDA_BASE_URL=https://www.smartagenda.fr/pro/laserostop-esh-dev/api
```
```
SMART_AGENDA_LOGIN=eshapiFG42dmPs87JxX
```
```
SMART_AGENDA_PWD=f3be0da94b09f33ae362fa92a069508c50c67150
```
```
SMART_AGENDA_API_ID=app_landing
```
```
SMART_AGENDA_API_KEY=84Pm-92tQ-49Rt24LSpe2C
```
```
NODE_ENV=production
```
```
PORT=3000
```
```
CORS_ORIGIN=*
```

### 5. Deploy!
- Click "Create Web Service"
- Wait 3-5 minutes for deployment
- Once deployed, you'll see: ✅ "Live" with a green dot
- **Copy your backend URL**: `https://laserostop-backend-xxxx.onrender.com`

### 6. Test Backend
Open in browser: `https://your-backend-url.onrender.com/api/health`

Should see:
```json
{"status":"ok","timestamp":"...","tokenCached":false}
```

✅ **Backend deployed!**

---

## Step 2: Deploy Frontend to Netlify (10 minutes)

### 1. Go to Netlify
- Open: https://netlify.com
- Click "Sign up" or "Log in"
- Sign up with your GitHub account (Amineregayeg)

### 2. Import Project
- Click "Add new site" → "Import an existing project"
- Click "Deploy with GitHub"
- Authorize Netlify to access your GitHub
- Select repository: **laserostop-espana**

### 3. Configure Build Settings
```
Base directory: (leave empty)
Build command: (leave empty)
Publish directory: (leave empty)
```

### 4. Deploy!
- Click "Deploy laserostop-espana"
- Wait 1-2 minutes
- Once deployed, you'll see your site URL: `https://something-random.netlify.app`
- **Copy your Netlify URL**

### 5. Test Frontend (Before Update)
- Open your Netlify URL
- You'll see the page but backend connection won't work yet
- That's OK! We'll fix it in Step 3

✅ **Frontend deployed!**

---

## Step 3: Connect Frontend to Backend (5 minutes)

### 1. Update index.html with your Backend URL

You need to update the API URL in the code. I'll create a script to help you:

**Option A: Manual Edit**
1. On GitHub, go to: https://github.com/Amineregayeg/laserostop-espana
2. Click on file: `index.html`
3. Click pencil icon (Edit)
4. Find line 551 (search for `API_BASE_URL`)
5. Replace `https://laserostop-backend.onrender.com/api` with YOUR actual backend URL
6. Example: `https://laserostop-backend-abc123.onrender.com/api`
7. Click "Commit changes"
8. Netlify will auto-redeploy (wait 1 minute)

**Option B: Command Line (if you prefer)**
```bash
cd /mnt/d/LP-espagne/lp_code

# Edit index.html line 551 to use your actual backend URL
# Then:
git add index.html
git commit -m "Update backend URL for production"
git push
```

### 2. Update CORS on Backend
Go back to Render.com:
1. Open your backend service
2. Go to "Environment" tab
3. Edit `CORS_ORIGIN` variable
4. Change from `*` to your Netlify URL: `https://your-site.netlify.app`
5. Save
6. Service will automatically restart

✅ **Connected!**

---

## Step 4: Test Everything! (10 minutes)

### 1. Open Your Netlify Site
Go to: `https://your-site.netlify.app`

### 2. Test Booking Flow
- [ ] Logo appears ✓
- [ ] Map loads with 8 center markers ✓
- [ ] Select a center from dropdown (should load from API) ✓
- [ ] Calendar displays ✓
- [ ] Click a future date ✓
- [ ] Time slots appear ✓
- [ ] Select a time slot ✓
- [ ] Fill in form:
  - Name: Test Usuario
  - Email: test@example.com
  - Phone: +34612345678
- [ ] Click "Confirmar la cita"
- [ ] Success message appears ✓

### 3. Verify in Smart Agenda
- Go to: https://www.smartagenda.fr/pro/laserostop-esh-dev/agenda
- Login with dev credentials
- Find your test booking in the calendar
- **It should be there!** ✓

### 4. Check Browser Console (F12)
- Open browser DevTools (press F12)
- Go to Console tab
- Should see no red errors ✓
- Should see logs like "Loading centers from Smart Agenda..."

✅ **Everything working!**

---

## 🎉 Success!

Your site is now live and functional!

**Your URLs:**
- Frontend: `https://your-site.netlify.app`
- Backend: `https://your-backend.onrender.com`
- GitHub: https://github.com/Amineregayeg/laserostop-espana

---

## 📋 Quick Reference

### Backend Environment Variables (Render)
```
SMART_AGENDA_BASE_URL=https://www.smartagenda.fr/pro/laserostop-esh-dev/api
SMART_AGENDA_LOGIN=eshapiFG42dmPs87JxX
SMART_AGENDA_PWD=f3be0da94b09f33ae362fa92a069508c50c67150
SMART_AGENDA_API_ID=app_landing
SMART_AGENDA_API_KEY=84Pm-92tQ-49Rt24LSpe2C
NODE_ENV=production
PORT=3000
CORS_ORIGIN=* (then update to your Netlify URL)
```

---

## ⚠️ Troubleshooting

### Backend won't start
- Check all environment variables are added
- Check logs on Render dashboard
- Verify `Root Directory` is set to `backend`

### "Cannot connect to backend"
- Update index.html line 551 with correct backend URL
- Make sure backend URL ends with `/api`
- Check backend is "Live" on Render

### "CORS policy error"
- Update `CORS_ORIGIN` on Render to your Netlify domain
- Include `https://` in the URL
- Restart service after updating

### Render service "sleeping"
- Free tier sleeps after 15 min inactivity
- First request takes 30 seconds to wake up
- This is normal for free tier

---

## 🔄 Making Updates Later

**To update backend:**
```bash
# Make changes to backend/server.js
git add backend/
git commit -m "Update backend"
git push
# Render auto-deploys from GitHub
```

**To update frontend:**
```bash
# Make changes to index.html
git add index.html
git commit -m "Update frontend"
git push
# Netlify auto-deploys from GitHub
```

---

## 💰 Costs

- Render Free Tier: $0/month
- Netlify Free Tier: $0/month
- GitHub: Free
- **Total: $0/month** ✓

---

**Ready! Start with Step 1 above!**

Estimated total time: **30-40 minutes**
