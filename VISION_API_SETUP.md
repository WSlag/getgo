# Google Cloud Vision API Setup Guide

## Problem
Your payment verification system is showing this error:
```
OCR failed: 7 PERMISSION_DENIED: Cloud Vision API has not been used in project 580800488549 before or it is disabled.
```

## Solution

### Step 1: Enable Cloud Vision API

**Method A: Using the Quick Script**
1. Run `enable-vision-api.bat` in this directory
2. Click "Enable" in the browser window that opens
3. Wait 1-2 minutes for activation

**Method B: Manual Steps**
1. Go to: https://console.cloud.google.com/apis/library/vision.googleapis.com?project=karga-ph
2. Click **"Enable"** button
3. Wait for confirmation message

**Method C: Via gcloud CLI** (if installed)
```bash
gcloud services enable vision.googleapis.com --project=karga-ph
```

### Step 2: Verify API is Enabled

1. Go to: https://console.cloud.google.com/apis/dashboard?project=karga-ph
2. You should see "Cloud Vision API" in the list of enabled APIs

### Step 3: Check Billing

Cloud Vision API requires billing to be enabled:
1. Go to: https://console.cloud.google.com/billing?project=karga-ph
2. Make sure a billing account is linked
3. Cloud Vision has a free tier:
   - First 1,000 units per month: FREE
   - After that: $1.50 per 1,000 units

### Step 4: Test the Payment Flow

1. Go back to your application
2. Try submitting a payment screenshot again
3. The OCR should now process successfully

## What This API Does

The Cloud Vision API:
- Reads text from GCash payment screenshots (OCR)
- Extracts reference numbers, amounts, sender/receiver names
- Validates payment authenticity
- Prevents fraud through image analysis

## Cost Estimate

For a marketplace application:
- **Free tier**: 1,000 OCR requests/month
- **Typical usage**: ~100-500 requests/month (low volume)
- **Estimated cost**: $0-5/month

## Troubleshooting

### Error: "API not enabled"
- Wait 2-3 minutes after enabling
- Try refreshing your application

### Error: "Billing required"
- Enable billing in Google Cloud Console
- Link a payment method

### Error: "Quota exceeded"
- Check: https://console.cloud.google.com/apis/api/vision.googleapis.com/quotas?project=karga-ph
- Increase quota if needed

## Support

If issues persist:
1. Check Cloud Functions logs: `firebase functions:log`
2. Check Firebase console: https://console.firebase.google.com/project/karga-ph/functions
3. Verify service account permissions

## Alternative: Test Mode

For development/testing without Vision API:
- Consider adding a manual approval option for admins
- Use the existing manual review system
- Enable Vision API before production launch
