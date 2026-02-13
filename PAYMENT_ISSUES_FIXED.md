# Payment Issues - Fixed

## Issues Identified

### 1. ✅ CORS Error - `createPlatformFeeOrder` not accessible
**Problem:** Cloud Function wasn't exported in main index.js
**Solution:** Added export in [functions/index.js:753](functions/index.js#L753)
**Status:** FIXED & DEPLOYED

### 2. ✅ Admin Dashboard Not Showing Payments
**Problem:** API response mismatch - backend returned `{ payments }` but frontend expected `{ submissions }`
**Solution:** Updated [functions/src/api/admin.js:104](functions/src/api/admin.js#L104) to return `submissions`
**Status:** FIXED & DEPLOYED

### 3. ⚠️ Cloud Vision API Not Enabled
**Problem:** OCR processing fails with "PERMISSION_DENIED: Cloud Vision API has not been used in project"
**Solution:** Manual enablement required
**Status:** REQUIRES USER ACTION

## How to Enable Cloud Vision API

### Quick Fix
1. Click: [Enable Cloud Vision API](https://console.cloud.google.com/apis/library/vision.googleapis.com?project=karga-ph)
2. Click "Enable" button
3. Wait 1-2 minutes
4. Try payment again

### Or Run Script
Double-click: `enable-vision-api.bat`

## Current Payment Flow

### When OCR Fails (Vision API disabled)
1. User uploads screenshot ➡️ Status: "Verification Failed"
2. Payment marked as `status: 'manual_review'`
3. **Payment DOES appear** in Admin Dashboard under "Pending Review"
4. Admin can manually approve or reject

### When OCR Succeeds (Vision API enabled)
1. User uploads screenshot ➡️ OCR extracts data
2. Fraud detection runs
3. Auto-approve if all checks pass
4. Manual review if fraud score high

## Testing the Fix

### Test 1: Check Admin Dashboard
1. Go to Admin Dashboard > Payments
2. Click "Flagged" filter
3. You should see your test payment submission
4. Click to view details and approve/reject

### Test 2: Submit New Payment
1. Go to any accepted bid
2. Click "Pay Platform Fee"
3. Upload a dummy screenshot
4. Check Admin Dashboard - should appear immediately

## Deployed Functions

- ✅ `createPlatformFeeOrder` (asia-southeast1)
- ✅ `adminGetPendingPayments` (asia-southeast1)
- ✅ `adminGetContracts` (asia-southeast1)

## What Still Needs Attention

### Priority 1: Enable Cloud Vision API
- **Why:** Allows automatic payment verification
- **Impact:** Without it, ALL payments require manual review
- **Cost:** FREE for first 1,000/month
- **Time:** 2 minutes to enable

### Priority 2: Test Payment Approval Flow
1. Enable Vision API
2. Submit real GCash screenshot
3. Verify auto-approval works
4. Check contract creation triggers

### Priority 3: Monitor Logs
```bash
firebase functions:log --only processPaymentSubmission
```

## Firestore Collections Updated

When payment is processed:
- `orders/{orderId}` - status updated
- `paymentSubmissions/{submissionId}` - OCR results stored
- `platformFees/{feeId}` - fee recorded (if approved)
- `contracts/{contractId}` - auto-created (if approved)
- `users/{userId}/notifications/{notifId}` - user notified

## API Endpoints Fixed

### Frontend ➡️ Cloud Functions
```javascript
// Now working:
api.wallet.createPlatformFeeOrder({ bidId })

// Now returns correct format:
api.admin.getPendingPayments({ status: 'manual_review' })
// Returns: { submissions: [...], total: N }

// New function:
api.admin.getContracts({ status: 'pending' })
// Returns: { contracts: [...], total: N }
```

## Next Steps

1. **Enable Cloud Vision API** (see link above)
2. **Test full payment flow** with real GCash screenshot
3. **Monitor admin dashboard** for payments appearing
4. **Check notifications** system working
5. **Verify contract creation** after approval

## Support Files Created

- `enable-vision-api.bat` - Quick enablement script
- `VISION_API_SETUP.md` - Detailed setup guide
- `PAYMENT_ISSUES_FIXED.md` - This file

## Questions?

Check Firebase logs:
```bash
cd functions
firebase functions:log
```

Or check Firestore directly in Firebase Console.
