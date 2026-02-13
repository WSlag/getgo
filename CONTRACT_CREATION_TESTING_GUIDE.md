# Contract Creation Testing Guide

## Overview
This guide explains how to test the complete contract creation flow with GCash payment screenshot upload for the Karga marketplace.

---

## Current Test Scenario

From your screenshot:
- **Listing Type**: Cargo (Construction Materials)
- **Route**: Cebu City → Davao City
- **Weight**: 10 tons
- **Asking Price**: ₱45,000
- **Shipper**: Juan Cruz
- **Accepted Bid**: James Laba - ₱40,000 (Accepted)
- **Platform Fee**: ₱2,000 (5% of accepted bid)

---

## GCash Configuration

Your system is configured with:
- **Account Name**: GetGo
- **Account Number**: 09272240000
- **QR Code**: Already uploaded to Firebase Storage
- **Order Expiry**: 30 minutes

---

## Step-by-Step Testing Process

### 1️⃣ **Initiate Contract Creation**

**As Juan Cruz (Shipper/Cargo Owner):**

1. Click on your cargo listing to open the Cargo Details modal
2. Find the "Bids Received" section
3. Locate James Laba's accepted bid (₱40,000 - Status: Accepted)
4. Click the orange **"Create Contract"** button next to the bid

**Expected Result:**
- Platform Fee payment modal opens

---

### 2️⃣ **Review Platform Fee (Info Step)**

The **"Platform Service Fee"** modal displays:

```
Route: Cebu City → Davao City

Fee Breakdown:
├─ Agreed Freight Rate: ₱40,000
├─ Platform Fee (5%): ₱2,000
└─ Amount to Pay: ₱2,000

What happens after payment:
1. Scan QR code and pay via GCash
2. Upload your payment screenshot
3. Automatic verification (10-30 seconds)
4. Contract generated for both parties to sign
```

**Action:** Click **"Pay via GCash"** button

---

### 3️⃣ **GCash Payment (QR Step)**

The modal shows:

```
┌─────────────────────────┐
│                         │
│    [QR CODE IMAGE]      │
│                         │
└─────────────────────────┘

Send to: GetGo
Account: 0927-224-0000

Amount to Send: ₱2,000

⏱️ Expires in 30 minutes

📱 Payment Instructions:
1. Open your GCash app
2. Scan the QR code above or send to 09272240000
3. Send exactly ₱2,000
4. Take a screenshot of the successful transaction
```

---

### 4️⃣ **Make GCash Payment**

You have **two options** for testing:

#### **Option A: Real GCash Payment** (Recommended for Production Testing)

1. Open your **GCash mobile app**
2. Tap **"Send Money"**
3. Choose **"Scan QR"** or **"Send to Mobile Number"**
4. If scanning: Point camera at QR code
5. If manual: Enter **09272240000**
6. Enter amount: **₱2,000.00** (must be exact)
7. Confirm recipient is **"GetGo"**
8. Complete the transaction
9. **Take a screenshot** of the success screen showing:
   - ✅ Reference number (13 digits)
   - ✅ Amount (₱2,000.00)
   - ✅ Receiver name (GetGo)
   - ✅ Transaction timestamp
   - ✅ "Successful" status

#### **Option B: Mock Screenshot** (For Development Testing)

Create a test image with these elements clearly visible:

**Required Information:**
```
GCash Transaction Receipt
━━━━━━━━━━━━━━━━━━━━━━━━
✓ Successful

Reference No: 1234567890123
Amount: ₱2,000.00
To: GetGo (09272240000)
Date: Feb 8, 2026 3:45 PM
Status: Completed
```

**Screenshot Requirements:**
- Format: JPG, PNG, or WebP
- Max size: 5MB
- Must show reference number clearly
- Amount must match ₱2,000
- Receiver must match "GetGo"
- Recent timestamp (within expiry window)

**Sample Test Screenshot Template:**
You can use photo editing software or find a sample GCash receipt online and modify:
- Reference Number: 2345678901234
- Amount Sent: 2000.00
- Receiver: GetGo
- Account: 09272240000
- Date/Time: Current date and time
- Status: Successful

---

### 5️⃣ **Upload Screenshot (Upload Step)**

**Action:** Click **"I've Paid, Upload Screenshot"**

The upload interface appears:

1. Click **"Choose File"** button
2. Select your GCash screenshot from your device
3. Preview appears - verify it's clear and readable
4. If wrong file: Click the **X** button to remove and try again
5. If correct: Click **"Upload Screenshot"** button

**Upload Validation:**
- ✓ Make sure your screenshot shows:
  - Reference number clearly visible
  - Amount matches ₱2,000
  - Receiver name: GetGo
  - Transaction timestamp (recent)

**Expected Result:**
- File uploads to Firebase Storage
- Payment submission created in Firestore
- Proceeds to verification status step

---

### 6️⃣ **Verification Status (Status Step)**

The system automatically processes your screenshot using Google Vision API OCR.

#### **Status: Verifying Payment** ⏳

```
🔄 Verifying Payment

Please wait while we verify your GCash screenshot.
This usually takes 10-30 seconds...
```

**Backend Process:**
1. Cloud Function triggered (`onPaymentSubmissionCreated`)
2. OCR extracts text from screenshot
3. Validates reference number format (13 digits)
4. Validates amount matches order amount
5. Validates receiver name matches
6. Checks for duplicate reference numbers
7. Validates timestamp is within expiry window

---

#### **Possible Outcomes:**

### ✅ **Status: Approved** (Success)

```
✅ Payment Verified!

Your payment has been approved and your contract
is being created. You will be redirected shortly.
```

**What Happens:**
1. Contract automatically created in Firestore
2. Contract includes:
   - Contract ID
   - Bid ID and Listing ID
   - Shipper: Juan Cruz
   - Trucker: James Laba
   - Route: Cebu City → Davao City
   - Agreed Price: ₱40,000
   - Platform Fee: ₱2,000 (Paid)
   - Status: pending_signatures
   - Participant IDs for security
3. Both parties receive notifications
4. Platform fee recorded in `platformFees` collection
5. Payment submission marked as approved
6. Modal closes automatically after 2 seconds

**Next Steps:**
- View contract in "My Contracts" section
- Both parties can sign the contract
- After both sign, shipment tracking begins

---

### ⏱️ **Status: Manual Review** (OCR Uncertain)

```
⏱️ Pending Admin Review

Your payment is being reviewed by our team.
This usually takes 5-10 minutes.
You'll be notified once approved.
```

**Reasons for Manual Review:**
- OCR couldn't extract reference number clearly
- Amount text unclear or ambiguous
- Receiver name doesn't match exactly
- Timestamp unclear
- Screenshot quality too low
- Suspicious patterns detected

**What to Do:**
- Click **"Close"** button
- Wait for admin notification
- Admin reviews in Admin Dashboard → Payments tab
- Admin can approve or reject with reason

---

### ❌ **Status: Rejected** (Verification Failed)

```
❌ Verification Failed

Your payment could not be verified.
Please try again with a clear screenshot.

Issues found:
• Reference number not found
• Amount mismatch (found ₱1,500, expected ₱2,000)
• Receiver name doesn't match
```

**What to Do:**
1. Click **"Try Again"** button
2. Returns to QR step
3. Take a new, clearer screenshot ensuring:
   - Better lighting
   - Full screen visible
   - Text is sharp and readable
   - No glare or reflections
   - All required fields visible
4. Upload new screenshot

---

## 7️⃣ **Verify Contract Created**

### **Check in Firestore Console:**

Navigate to: [Firebase Console](https://console.firebase.google.com/project/karga-ph/firestore/databases/-default-/data)

**1. Check `contracts` collection:**
```javascript
contracts/{contractId}
{
  bidId: "...",
  cargoListingId: "...",
  participantIds: ["<Juan's UID>", "<James' UID>"],
  shipperId: "<Juan's UID>",
  truckerId: "<James' UID>",
  shipperName: "Juan Cruz",
  truckerName: "James Laba",
  origin: "Cebu City",
  destination: "Davao City",
  cargoType: "Construction Materials",
  weight: 10,
  weightUnit: "tons",
  agreedPrice: 40000,
  platformFee: 2000,
  platformFeePaid: true,
  status: "pending_signatures",
  shipperSigned: false,
  truckerSigned: false,
  createdAt: <timestamp>,
  updatedAt: <timestamp>
}
```

**2. Check `platformFees` collection:**
```javascript
platformFees/{feeId}
{
  userId: "<Juan's UID>", // shipper who paid
  bidId: "...",
  contractId: "...",
  amount: 2000,
  status: "paid",
  paymentMethod: "gcash",
  orderId: "...",
  submissionId: "...",
  createdAt: <timestamp>
}
```

**3. Check `paymentSubmissions` collection:**
```javascript
paymentSubmissions/{submissionId}
{
  userId: "<Juan's UID>",
  orderId: "...",
  bidId: "...",
  screenshotUrl: "https://firebasestorage...",
  status: "approved",
  ocrStatus: "completed",
  extractedData: {
    referenceNumber: "1234567890123",
    amount: "2000",
    receiverName: "GetGo"
  },
  validationErrors: [],
  createdAt: <timestamp>,
  verifiedAt: <timestamp>
}
```

---

### **Check in Application UI:**

**For Juan Cruz (Shipper):**
1. Navigate to **"Tracking"** tab or **"My Contracts"** section
2. Should see new contract:
   ```
   Contract #ABC123
   Route: Cebu City → Davao City
   Partner: James Laba (Trucker)
   Price: ₱40,000
   Status: Pending Signatures
   Action: [Sign Contract]
   ```

**For James Laba (Trucker):**
1. Receives notification: "New contract created for your bid!"
2. Navigate to contracts section
3. Should see same contract
4. Action: [Sign Contract]

---

## Troubleshooting

### Issue: "Failed to create payment order"

**Causes:**
- Backend server not running
- Database connection error
- Bid already has a contract

**Solutions:**
1. Verify backend is running: `cd backend && npm start`
2. Check backend logs for errors
3. Verify bid status is "accepted" not "contracted"

---

### Issue: QR Code Not Showing

**Causes:**
- `GCASH_QR_URL` not set in backend `.env`
- Firebase Storage URL invalid or expired

**Solutions:**
1. Check `backend/.env` has:
   ```
   GCASH_QR_URL=https://firebasestorage.googleapis.com/...
   ```
2. Upload new QR to Firebase Storage if needed
3. Update `.env` with new URL
4. Restart backend server

---

### Issue: Upload Fails

**Causes:**
- File too large (>5MB)
- Invalid file format
- Firebase Storage permissions
- Network error

**Solutions:**
1. Compress image to under 5MB
2. Use JPG, PNG, or WebP format only
3. Check Firebase Storage rules allow authenticated writes
4. Check browser console for detailed error

---

### Issue: Verification Stuck on "Verifying Payment"

**Causes:**
- Cloud Function not deployed
- Vision API not enabled
- Vision API quota exceeded
- Function timeout or error

**Solutions:**
1. Deploy functions: `cd functions && firebase deploy --only functions`
2. Enable Vision API: `gcloud services enable vision.googleapis.com`
3. Check Cloud Functions logs in Firebase Console
4. Check Vision API quotas in Google Cloud Console

---

### Issue: Always Goes to Manual Review

**Causes:**
- Screenshot quality too low
- OCR confidence threshold too high
- Text not readable by OCR

**Solutions:**
1. Use higher resolution screenshot
2. Ensure text is sharp and clear
3. Avoid screenshots with:
   - Glare or reflections
   - Motion blur
   - Low contrast
   - Small font sizes
4. Adjust OCR confidence threshold in function code (currently 0.7)

---

### Issue: Contract Not Created After Approval

**Causes:**
- `createContractFromBid` function error
- Missing required bid/listing data
- Firestore security rules blocking write

**Solutions:**
1. Check Cloud Function logs for `createContractFromBid` errors
2. Verify bid document has all required fields
3. Check Firestore rules allow contract creation
4. Verify both user UIDs exist and are valid

---

## Admin Verification (Manual Review)

If payment goes to manual review, admins can verify via:

### **Admin Dashboard → Payments Tab**

1. Login as admin user
2. Navigate to Admin Dashboard
3. Click **"Payments"** tab
4. Find pending submission
5. View screenshot
6. Verify details match GCash receipt
7. Click **"Approve"** or **"Reject"**
8. If rejecting, provide clear reason

**Admin Actions Trigger:**
- Same contract creation flow as automatic approval
- User receives notification of approval/rejection
- If rejected, user can retry upload

---

## Security Notes

### **Fraud Prevention:**
- Reference numbers checked for duplicates (prevents reusing same screenshot)
- Amount must match exactly (prevents wrong amount screenshots)
- Receiver name must match (prevents screenshots from different merchants)
- Timestamp validated (prevents old screenshot reuse)
- Image hash checked (prevents duplicate image uploads)

### **Privacy:**
- Screenshots stored in Firebase Storage with user-specific paths
- Only admin and payment owner can view screenshots
- URLs time-limited via Firebase Storage rules

---

## Next Steps After Contract Created

1. **Both parties sign contract**
   - Shipper signs first or trucker signs first (order doesn't matter)
   - After both signatures collected, status → "active"

2. **Shipment tracking begins**
   - Trucker can update shipment status
   - Real-time location tracking (if enabled)
   - Shipper can monitor progress

3. **Delivery completion**
   - Trucker marks "delivered"
   - Shipper confirms receipt
   - Both parties rate each other
   - Platform fee released to platform
   - Freight payment handled separately (off-platform or wallet)

---

## Test Checklist

- [ ] Can initiate contract creation from accepted bid
- [ ] Platform fee modal displays correct information
- [ ] QR code loads and displays correctly
- [ ] Account name and number visible
- [ ] Can upload screenshot (various formats)
- [ ] File size validation works (<5MB)
- [ ] Upload progress indicator shows
- [ ] OCR verification completes (10-30s)
- [ ] Approved status shows success message
- [ ] Contract created in Firestore
- [ ] Platform fee recorded correctly
- [ ] Both parties receive notifications
- [ ] Can view contract in UI
- [ ] Manual review flow works (if triggered)
- [ ] Admin can approve/reject in dashboard
- [ ] Rejection allows retry
- [ ] Duplicate reference number detected
- [ ] Amount mismatch detected
- [ ] Receiver name mismatch detected

---

## Files Modified for This Feature

- `frontend/src/components/modals/GCashPaymentModal.jsx` - Payment UI
- `frontend/src/services/firestoreService.js` - Upload functions
- `frontend/src/hooks/usePaymentSubmission.js` - Real-time status
- `backend/src/routes/wallet.js` - Order creation endpoint
- `functions/index.js` - OCR verification Cloud Function
- `firestore.rules` - Security rules for payments

---

## Additional Resources

- [GCash Developer Docs](https://developer.gcash.com)
- [Firebase Storage Rules](https://firebase.google.com/docs/storage/security)
- [Google Vision API OCR](https://cloud.google.com/vision/docs/ocr)
- [Payment Verification Flow Diagram](./PAYMENT_VERIFICATION_FLOW.md)

---

**Last Updated**: February 8, 2026
**Tested By**: [Your Name]
**Status**: ✅ Ready for Testing
