# 🔍 Contract Creation Investigation Report
**Date:** February 8, 2026
**Issue:** Two approved platform fee payments did not create contracts

---

## 📋 Summary

Two payments were approved but did not create contracts:
1. **Payment xaEHEUglwJg3...** (PHP 3,750) - Approved Feb 7, 14:24:40
2. **Payment qXaQlpjZZ00G...** (PHP 5,000) - Approved Feb 7, 14:14:03

---

## 🕵️ Root Cause Analysis

### Timeline

| Date/Time | Event |
|-----------|-------|
| **Feb 7, 14:14:03** | Payment #2 (PHP 5,000) approved by admin |
| **Feb 7, 14:24:40** | Payment #1 (PHP 3,750) approved by admin |
| **Feb 8, 01:19:00** | **CODE FIX DEPLOYED** to Cloud Functions |
| **Feb 8** | User notices contracts are missing |

### Critical Finding

**The payments were approved BEFORE the bug fix was deployed.**

Cloud Functions logs show:
```
2026-02-07T14:14:03.946375Z adminApprovePayment: Wallet credited: ₱5000 for user WWx43A9uUCdvnxs8wWcFt8TiyhC3
2026-02-07T14:24:40.221889Z adminApprovePayment: Wallet credited: ₱3750 for user WWx43A9uUCdvnxs8wWcFt8TiyhC3
```

The message **"Wallet credited"** confirms the OLD buggy code was running, which treated these as wallet top-ups instead of platform fees.

---

## 🐛 The Original Bug (Now Fixed)

**File:** `functions/index.js` (line 249)

**Old Code Flow:**
```javascript
async function approvePayment(submission, order, submissionId) {
  // Update order status
  await db.collection('orders').doc(submission.orderId).update({
    status: 'verified',
    verifiedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  if (order.type === 'platform_fee') {
    // ✅ This part was CORRECT - creates contract
    console.log(`Processing platform fee payment for bid ${order.bidId}`);
    await createContractFromApprovedFee(order.bidId, submission.userId);
  } else {
    // ❌ BUG: This branch was incorrectly taken
    console.log(`Wallet credited: ₱${order.amount} for user ${submission.userId}`);
    // Credit wallet instead of creating contract
  }
}
```

**The Issue:**
The `if (order.type === 'platform_fee')` check failed, causing the `else` branch to execute and credit the wallet instead of creating a contract.

**Possible Reasons:**
1. **order.type was NULL** - The field wasn't set when the order was created
2. **order.type was 'topup'** - Wrong value stored in Firestore
3. **order.type was undefined** - Field missing entirely from the document

---

## 🔎 What to Check in Firestore

To determine the exact cause, check the actual Firestore data:

### Step 1: Check Payment Submission Documents

**Collection:** `paymentSubmissions`

**Document IDs:**
- `xaEHEUglwJg3...` (PHP 3,750)
- `qXaQlpjZZ00G...` (PHP 5,000)

**Fields to Check:**
```javascript
{
  orderId: "...",           // Should exist
  userId: "WWx43A9uUCdvnxs8wWcFt8TiyhC3",
  amount: 3750 or 5000,
  status: "approved",
  resolvedAt: Timestamp,
  resolvedBy: "admin_uid"
}
```

### Step 2: Check Order Documents

**Collection:** `orders`

**Document IDs:** Use the `orderId` from the payment submissions above

**Critical Field to Check:**
```javascript
{
  orderId: "...",
  type: "???",              // ⚠️ CHECK THIS - Should be 'platform_fee'
  bidId: "...",             // Should exist
  userId: "WWx43A9uUCdvnxs8wWcFt8TiyhC3",
  amount: 3750 or 5000,
  status: "verified",
  verifiedAt: Timestamp
}
```

**Expected Value:** `type: "platform_fee"`
**If Different:** This is the root cause

### Step 3: Check Bid Documents

**Collection:** `bids`

**Document ID:** Use the `bidId` from the order above

**Fields to Check:**
```javascript
{
  bidId: "QoSX1o1PVQ4k7gsSYde6",  // For the PHP 3,750 payment
  status: "???",                   // Should be 'accepted' for contract creation
  agreedPrice: 3750,
  bidderId: "...",
  listingOwnerId: "WWx43A9uUCdvnxs8wWcFt8TiyhC3"
}
```

**Required for Contract Creation:**
- Bid `status` must be `"accepted"` or `"contracted"`
- If status is `"pending"`, contracts cannot be created

---

## 🔧 How the Fixed Code Works (Deployed Feb 8)

**New Flow (functions/index.js line 239-331):**
```javascript
async function approvePayment(submission, order, submissionId) {
  await db.collection('orders').doc(submission.orderId).update({
    status: 'verified',
    verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
    verifiedSubmissionId: submissionId,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  if (order.type === 'platform_fee') {
    console.log(`Processing platform fee payment for bid ${order.bidId}`);

    // Record platform fee
    await db.collection('platformFees').doc().set({
      orderId: submission.orderId,
      submissionId,
      userId: submission.userId,
      bidId: order.bidId,
      amount: order.amount,
      status: 'completed',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Auto-create contract
    try {
      const contract = await createContractFromApprovedFee(order.bidId, submission.userId);
      console.log(`Contract created: ${contract.contractNumber}`);

      // Send notification
      await db.collection(`users/${submission.userId}/notifications`).doc().set({
        type: 'CONTRACT_CREATED',
        title: 'Payment Verified & Contract Created!',
        message: `Your payment has been verified and contract #${contract.contractNumber} has been created.`,
        contractId: contract.id,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (contractError) {
      console.error(`Failed to create contract for bid ${order.bidId}:`, contractError);

      // Send error notification
      await db.collection(`users/${submission.userId}/notifications`).doc().set({
        type: 'PAYMENT_APPROVED',
        title: 'Payment Verified',
        message: `Your payment has been verified, but there was an issue creating the contract. Please contact support.`,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }
  } else {
    // Legacy wallet top-up flow
    console.log(`Wallet credited: ₱${order.amount} for user ${submission.userId}`);
    // ... credit wallet
  }
}
```

**Key Improvements:**
1. ✅ Records `platformFees` entry
2. ✅ Creates contract via `createContractFromApprovedFee()`
3. ✅ Sends proper `CONTRACT_CREATED` notification
4. ✅ Has error handling and fallback notification
5. ✅ Logs detailed information for debugging

---

## 📊 Verification Queries

### Using Firebase Console

**Query 1: Check if order.type is set correctly**
```
Collection: orders
Filter: __name__ == {orderId from payment}
Expected: type == "platform_fee"
```

**Query 2: Check if platformFees was recorded**
```
Collection: platformFees
Filter: submissionId == xaEHEUglwJg3...
Expected: Should NOT exist (payment was approved with old code)
```

**Query 3: Check if contract exists**
```
Collection: contracts
Filter: bidId == QoSX1o1PVQ4k7gsSYde6
Expected: Should NOT exist (payment was approved with old code)
```

**Query 4: Check bid status**
```
Collection: bids
Filter: __name__ == QoSX1o1PVQ4k7gsSYde6
Expected: status should be "accepted" or "contracted"
```

### Using Verification Tool

Navigate to: **Admin Dashboard → Verify Contracts**

The tool will automatically check:
- ✅ Payment submission status
- ✅ Order type and status
- ✅ Platform fee recording
- ✅ Contract creation
- ✅ Bid status and validation
- ✅ Listing status

---

## 🎯 Expected Findings

Based on the logs, here's what we expect to find:

### Payment xaEHEUglwJg3... (PHP 3,750)

| Field | Expected Value | Reason |
|-------|----------------|--------|
| `paymentSubmissions/{id}.status` | `"approved"` | Admin approved it |
| `paymentSubmissions/{id}.orderId` | Exists | Should link to order |
| `orders/{orderId}.type` | **NULL or 'topup'** | ⚠️ Likely the bug |
| `orders/{orderId}.status` | `"verified"` | Payment was approved |
| `platformFees` (by submissionId) | **NOT FOUND** | Old code didn't record it |
| `contracts` (by bidId) | **NOT FOUND** | Old code didn't create it |
| `bids/{bidId}.status` | `"accepted"` | From verification tool |

### Payment qXaQlpjZZ00G... (PHP 5,000)

| Field | Expected Value | Reason |
|-------|----------------|--------|
| `paymentSubmissions/{id}.status` | `"approved"` | Admin approved it |
| `paymentSubmissions/{id}.orderId` | Exists | Should link to order |
| `orders/{orderId}.type` | **NULL or missing** | ⚠️ Verification tool shows blank |
| `orders/{orderId}.status` | `"verified"` | Payment was approved |
| `platformFees` (by submissionId) | **NOT FOUND** | Old code didn't record it |
| `contracts` (by bidId) | **NOT FOUND** | Old code didn't create it |

---

## ✅ Action Items

### 1. Verify Current System is Working

**Test with a NEW payment approval:**
1. Create a new bid on a cargo listing
2. Accept the bid
3. Generate platform fee payment order
4. Submit GCash screenshot
5. Admin approves payment
6. **Expected Results:**
   - ✅ Contract auto-created
   - ✅ Proper notification sent
   - ✅ Listing status updated to "contracted"
   - ✅ Bid status updated to "contracted"
   - ✅ No "wallet credited" log message

### 2. Fix Historical Data (Optional)

**For the two broken payments, you have 3 options:**

**Option A: Manual Contract Creation (Recommended)**
- Use admin panel to manually trigger contract creation
- Requires adding an admin function to create contracts from existing approved payments

**Option B: Refund and Re-process**
- Mark payments as refunded
- Have user resubmit payment
- Approve with new code (will auto-create contract)

**Option C: Leave as-is**
- Document that these were processed before the fix
- User can use wallet balance for other transactions
- No contract needed for these specific payments

### 3. Investigate Order Creation Flow

**Check where orders are created:**
- File: `functions/src/api/wallet.js` (lines 98-117)
- Verify the `type: 'platform_fee'` is being set correctly
- Check if there are any conditions that might set it to NULL

**Expected Code:**
```javascript
const orderData = {
  orderId,
  userId,
  type: 'platform_fee',  // ✅ Should ALWAYS be set for platform fees
  bidId,
  listingId,
  listingOwnerId: userId,
  amount: platformFee,
  method: 'gcash',
  status: 'awaiting_upload',
  createdAt: admin.firestore.FieldValue.serverTimestamp()
};
```

---

## 📝 Next Steps

1. **Check Firestore Console:**
   - Open Firebase Console → Firestore Database
   - Navigate to `orders` collection
   - Find orders linked to the two payment submissions
   - **CHECK THE `type` FIELD VALUE** - this is the smoking gun

2. **Run Verification Tool:**
   - Navigate to Admin Dashboard
   - Click "Verify Contracts"
   - Run verification check
   - Take screenshot of results

3. **Test New Approval:**
   - Create test bid, accept it, pay platform fee
   - Admin approves payment
   - Verify contract is auto-created
   - Confirm new code is working

4. **Report Findings:**
   - What is the actual value of `order.type` for the two broken payments?
   - Is it NULL, 'topup', or something else?
   - This will tell us if the bug was in order creation or payment approval

---

## 🔍 Diagnosis Checklist

- [ ] Check `orders/{orderId}.type` for both payments
- [ ] Verify `bids/{bidId}.status` is "accepted"
- [ ] Confirm `platformFees` collection has NO entries for these submissions
- [ ] Confirm `contracts` collection has NO entries for these bidIds
- [ ] Test NEW payment approval to verify fix is working
- [ ] Decide on remediation approach for broken payments

---

**Created:** February 8, 2026
**Status:** Investigation in progress
**Priority:** High - Affects payment-to-contract flow
