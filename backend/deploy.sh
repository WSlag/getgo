#!/bin/bash
# KARGA CONNECT Backend Deployment Script for Linux/Mac
# This script deploys the Express backend to Google Cloud Run

set -e

echo "========================================"
echo "KARGA CONNECT - Backend Deployment"
echo "========================================"
echo ""

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "ERROR: Google Cloud SDK not found!"
    echo ""
    echo "Please install Google Cloud SDK first:"
    echo "https://cloud.google.com/sdk/docs/install"
    echo ""
    exit 1
fi

echo "Checking gcloud authentication..."
gcloud auth list

echo ""
echo "Setting project to karga-ph..."
gcloud config set project karga-ph

echo ""
echo "========================================"
echo "Deploying to Cloud Run..."
echo "========================================"
echo ""
echo "This will:"
echo "- Build a Docker container from your code"
echo "- Deploy to asia-southeast1 region"
echo "- Set up auto-scaling (0-10 instances)"
echo "- Allocate 512MB memory and 1 CPU"
echo ""

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
  --set-env-vars "NODE_ENV=production"

echo ""
echo "========================================"
echo "Deployment Successful!"
echo "========================================"
echo ""
echo "Getting service URL..."
SERVICE_URL=$(gcloud run services describe karga-backend --region asia-southeast1 --format="value(status.url)")
echo "Service URL: $SERVICE_URL"

echo ""
echo "Next steps:"
echo "1. Update CORS in backend/src/app.js with: $SERVICE_URL"
echo "2. Update frontend API URL in frontend/src/services/api.js"
echo "3. Configure Firebase service account credentials (see DEPLOYMENT_GUIDE.md)"
echo ""
