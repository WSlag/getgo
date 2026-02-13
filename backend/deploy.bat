@echo off
REM KARGA CONNECT Backend Deployment Script for Windows
REM This script deploys the Express backend to Google Cloud Run

echo ========================================
echo KARGA CONNECT - Backend Deployment
echo ========================================
echo.

REM Check if gcloud is installed
where gcloud >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: Google Cloud SDK not found!
    echo.
    echo Please install Google Cloud SDK first:
    echo https://cloud.google.com/sdk/docs/install
    echo.
    echo Or download the installer:
    echo https://dl.google.com/dl/cloudsdk/channels/rapid/GoogleCloudSDKInstaller.exe
    echo.
    pause
    exit /b 1
)

echo Checking gcloud authentication...
gcloud auth list

echo.
echo Setting project to karga-ph...
gcloud config set project karga-ph

echo.
echo ========================================
echo Deploying to Cloud Run...
echo ========================================
echo.
echo This will:
echo - Build a Docker container from your code
echo - Deploy to asia-southeast1 region
echo - Set up auto-scaling (0-10 instances)
echo - Allocate 512MB memory and 1 CPU
echo.

REM Deploy to Cloud Run
gcloud run deploy karga-backend ^
  --source . ^
  --platform managed ^
  --region asia-southeast1 ^
  --allow-unauthenticated ^
  --port 8080 ^
  --memory 512Mi ^
  --cpu 1 ^
  --min-instances 0 ^
  --max-instances 10 ^
  --timeout 300 ^
  --set-env-vars "NODE_ENV=production"

if %errorlevel% neq 0 (
    echo.
    echo ERROR: Deployment failed!
    echo.
    echo Troubleshooting tips:
    echo 1. Check if you have billing enabled for the project
    echo 2. Enable Cloud Run API: gcloud services enable run.googleapis.com
    echo 3. Enable Cloud Build API: gcloud services enable cloudbuild.googleapis.com
    echo.
    pause
    exit /b 1
)

echo.
echo ========================================
echo Deployment Successful!
echo ========================================
echo.
echo Getting service URL...
gcloud run services describe karga-backend --region asia-southeast1 --format="value(status.url)"

echo.
echo Next steps:
echo 1. Update CORS in backend/src/app.js with the Cloud Run URL above
echo 2. Update frontend API URL in frontend/src/services/api.js
echo 3. Configure Firebase service account credentials (see DEPLOYMENT_GUIDE.md)
echo.
pause
