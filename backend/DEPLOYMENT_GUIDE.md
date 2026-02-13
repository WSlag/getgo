# Backend Deployment Guide - KARGA CONNECT

This guide will help you deploy the Express backend to Google Cloud Run.

## Prerequisites

1. **Google Cloud SDK** - Install from https://cloud.google.com/sdk/docs/install
2. **Docker** (optional for local testing)
3. **Firebase Service Account Key** - Download from Firebase Console

---

## Step 1: Install Google Cloud SDK

### For Windows:
Download and run the installer:
```
https://dl.google.com/dl/cloudsdk/channels/rapid/GoogleCloudSDKInstaller.exe
```

After installation, open a new terminal and verify:
```bash
gcloud version
```

---

## Step 2: Authenticate with Google Cloud

```bash
# Login to your Google account
gcloud auth login

# Set the project
gcloud config set project karga-ph
```

---

## Step 3: Get Firebase Service Account Key

1. Go to Firebase Console: https://console.firebase.google.com/project/karga-ph/settings/serviceaccounts/adminsdk
2. Click "Generate new private key"
3. Save the JSON file as `serviceAccountKey.json` in the backend directory
4. **IMPORTANT:** Never commit this file to Git (it's already in .gitignore)

---

## Step 4: Deploy to Cloud Run

### Option A: Deploy with gcloud (Recommended)

```bash
cd backend

# Deploy to Cloud Run
gcloud run deploy karga-backend \
  --source . \
  --platform managed \
  --region asia-southeast1 \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10 \
  --timeout 300 \
  --set-env-vars "NODE_ENV=production" \
  --set-secrets "FIREBASE_SERVICE_ACCOUNT=karga-firebase-credentials:latest"
```

**Note:** You need to create the secret first:
```bash
# Create secret from service account key
gcloud secrets create karga-firebase-credentials \
  --data-file=serviceAccountKey.json \
  --replication-policy="automatic"

# Grant Cloud Run access to the secret
gcloud secrets add-iam-policy-binding karga-firebase-credentials \
  --member="serviceAccount:$(gcloud projects describe karga-ph --format='value(projectNumber)')-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### Option B: Deploy with environment variables (Simpler but less secure)

```bash
# Read the service account key
$SERVICE_ACCOUNT=$(cat serviceAccountKey.json | tr -d '\n' | tr -d ' ')

# Deploy
gcloud run deploy karga-backend \
  --source . \
  --platform managed \
  --region asia-southeast1 \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10 \
  --timeout 300 \
  --set-env-vars "NODE_ENV=production,FIREBASE_SERVICE_ACCOUNT=$SERVICE_ACCOUNT"
```

---

## Step 5: Update CORS Configuration

After deployment, you'll get a URL like:
```
https://karga-backend-XXXXXX-as.a.run.app
```

Update the CORS configuration in `backend/src/app.js`:

```javascript
// Add your Cloud Run URL
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000',
    'https://your-frontend-domain.com',  // Your production frontend
    'https://karga-backend-XXXXXX-as.a.run.app'  // Your Cloud Run URL
  ],
  credentials: true,
}));
```

Also update Socket.io CORS:

```javascript
const io = new Server(httpServer, {
  cors: {
    origin: [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:3000',
      'https://your-frontend-domain.com',
      'https://karga-backend-XXXXXX-as.a.run.app'
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  },
});
```

---

## Step 6: Update Frontend API Configuration

Update `frontend/src/services/api.js` to use the Cloud Run URL:

```javascript
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://karga-backend-XXXXXX-as.a.run.app/api';
```

Add to `frontend/.env.production`:
```
VITE_API_URL=https://karga-backend-XXXXXX-as.a.run.app/api
```

---

## Step 7: Test the Deployment

```bash
# Get the service URL
gcloud run services describe karga-backend --region asia-southeast1 --format='value(status.url)'

# Test health endpoint
curl https://karga-backend-XXXXXX-as.a.run.app/api/health
```

---

## Monitoring and Logs

```bash
# View logs
gcloud run services logs read karga-backend --region asia-southeast1 --limit 50

# View in Cloud Console
https://console.cloud.google.com/run?project=karga-ph
```

---

## Updating the Deployment

After making changes to the backend code:

```bash
cd backend
gcloud run deploy karga-backend \
  --source . \
  --region asia-southeast1
```

---

## Cost Optimization

Cloud Run pricing (as of 2024):
- **Free tier:** 2 million requests/month
- **CPU:** $0.00002400 per vCPU-second
- **Memory:** $0.00000250 per GiB-second
- **Requests:** $0.40 per million requests

With `--min-instances 0`, you only pay when the service is handling requests.

---

## Troubleshooting

### Issue: Service won't start
- Check logs: `gcloud run services logs read karga-backend --region asia-southeast1`
- Verify PORT environment variable is set to 8080 in Dockerfile

### Issue: Database connection errors
- The backend uses SQLite which is ephemeral in Cloud Run
- Consider migrating to Cloud SQL (PostgreSQL) or Firebase Firestore for persistence

### Issue: Socket.io not working
- Ensure WebSocket connections are allowed in Cloud Run (they are by default)
- Check CORS configuration includes the frontend domain

---

## Security Checklist

- [ ] Service account key is NOT committed to Git
- [ ] CORS is restricted to your domains only
- [ ] Environment variables are properly secured
- [ ] Cloud Run service has appropriate IAM permissions
- [ ] Secrets are stored in Secret Manager (not env vars)

---

## Next Steps

1. Set up a custom domain for your backend
2. Configure Cloud CDN for better performance
3. Set up monitoring and alerting
4. Implement CI/CD with GitHub Actions
5. Consider migrating from SQLite to Cloud SQL

For more information, see: https://cloud.google.com/run/docs
