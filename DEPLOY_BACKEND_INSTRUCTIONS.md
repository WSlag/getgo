# Quick Deploy Guide - KARGA Backend to Cloud Run

## 🚀 Quick Start (5 Steps)

### Step 1: Install Google Cloud SDK

I've already downloaded the installer for you. Run it:

```
C:\Users\Administrator\Downloads\GoogleCloudSDKInstaller.exe
```

**During installation:**
- ✅ Check "Run 'gcloud init' after installation"
- ✅ Check "Add to PATH"
- Click "Install"

After installation completes, a terminal will open automatically.

---

### Step 2: Initialize gcloud (in the opened terminal)

```bash
# Login to your Google account
gcloud auth login

# Set project
gcloud config set project karga-ph

# Enable required APIs
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable artifactregistry.googleapis.com
```

---

### Step 3: Get Firebase Service Account Key

1. Open: https://console.firebase.google.com/project/karga-ph/settings/serviceaccounts/adminsdk
2. Click **"Generate new private key"**
3. Save as `C:\Users\Administrator\Karga\backend\serviceAccountKey.json`

**⚠️ IMPORTANT:** Keep this file secure and never commit to Git!

---

### Step 4: Deploy the Backend

Open a NEW terminal (so PATH is updated), then:

```bash
cd C:\Users\Administrator\Karga\backend

# Run the deployment script
deploy.bat
```

This will:
- Build your backend into a Docker container
- Deploy to Google Cloud Run
- Give you a URL like: `https://karga-backend-xxxxx-as.a.run.app`

**Expected time:** 3-5 minutes

---

### Step 5: Update Configuration

After deployment, you'll get a URL. Update these files:

#### A. Update Backend CORS (`backend/src/app.js`)

Replace lines 79-82:
```javascript
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000',
    'https://YOUR-CLOUD-RUN-URL.run.app',  // ← Add this
    'https://karga-ph.web.app',  // ← Your Firebase Hosting URL
  ],
  credentials: true,
}));
```

#### B. Update Socket.io CORS (same file, lines 35-40)

```javascript
const io = new Server(httpServer, {
  cors: {
    origin: [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:3000',
      'https://YOUR-CLOUD-RUN-URL.run.app',  // ← Add this
      'https://karga-ph.web.app',  // ← Your Firebase Hosting URL
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  },
});
```

#### C. Update Frontend API URL (`frontend/.env.production`)

Create or update this file:
```env
VITE_API_URL=https://YOUR-CLOUD-RUN-URL.run.app/api
VITE_SOCKET_URL=https://YOUR-CLOUD-RUN-URL.run.app
```

#### D. Update Frontend API service (`frontend/src/services/api.js`)

Find the base URL configuration and update:
```javascript
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
```

---

### Step 6: Redeploy with Updated CORS

After updating the CORS settings:

```bash
cd C:\Users\Administrator\Karga\backend
deploy.bat
```

---

## 🧪 Testing the Deployment

```bash
# Test health endpoint
curl https://YOUR-CLOUD-RUN-URL.run.app/api/health

# Or open in browser
start https://YOUR-CLOUD-RUN-URL.run.app/api/health
```

Expected response:
```json
{
  "status": "ok",
  "message": "KARGA CONNECT API is running",
  "timestamp": "2026-02-12T..."
}
```

---

## 📊 View Logs and Monitor

```bash
# View recent logs
gcloud run services logs read karga-backend --region asia-southeast1 --limit 50

# Follow logs in real-time
gcloud run services logs tail karga-backend --region asia-southeast1

# Open Cloud Console
start https://console.cloud.google.com/run/detail/asia-southeast1/karga-backend
```

---

## 🔄 Updating After Code Changes

Whenever you update backend code:

```bash
cd C:\Users\Administrator\Karga\backend
deploy.bat
```

Cloud Run will:
1. Build a new container
2. Deploy with zero downtime
3. Keep the same URL

---

## 💰 Estimated Costs

**Cloud Run Free Tier (per month):**
- 2 million requests
- 360,000 GB-seconds memory
- 180,000 vCPU-seconds

**Your configuration:**
- Memory: 512MB
- CPU: 1
- Min instances: 0 (scales to zero = no cost when idle)
- Max instances: 10

**Estimated cost for low-medium traffic:** $0-5/month

---

## ⚠️ Troubleshooting

### Issue: "gcloud: command not found"
- Close and reopen your terminal
- Or run: `C:\Users\Administrator\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd`

### Issue: "Permission denied" during deploy
- Run: `gcloud auth login`
- Ensure you're logged in with the correct Google account

### Issue: "Billing not enabled"
- Go to: https://console.cloud.google.com/billing/linkedaccount?project=karga-ph
- Enable billing for the project

### Issue: "API not enabled"
- Run the commands from Step 2 to enable APIs
- Or enable manually in Cloud Console

### Issue: Backend not connecting to Firebase
- Ensure `serviceAccountKey.json` exists in backend directory
- Check logs: `gcloud run services logs read karga-backend --region asia-southeast1`

---

## 📚 Additional Resources

- **Full Deployment Guide:** `backend/DEPLOYMENT_GUIDE.md`
- **Cloud Run Docs:** https://cloud.google.com/run/docs
- **Firebase Admin SDK:** https://firebase.google.com/docs/admin/setup
- **Pricing Calculator:** https://cloud.google.com/products/calculator

---

## 🎯 Success Checklist

- [ ] Google Cloud SDK installed
- [ ] Authenticated with `gcloud auth login`
- [ ] Project set to `karga-ph`
- [ ] APIs enabled (run, cloudbuild, artifactregistry)
- [ ] Firebase service account key downloaded
- [ ] Backend deployed successfully
- [ ] Health endpoint returns 200 OK
- [ ] CORS updated with Cloud Run URL
- [ ] Frontend configured with new API URL
- [ ] Frontend redeployed to Firebase Hosting
- [ ] WebSocket connections working
- [ ] Firebase authentication working

---

**Need help?** Check `backend/DEPLOYMENT_GUIDE.md` for detailed troubleshooting.
