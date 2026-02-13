# Platform Fee Payment Flow - Implementation Complete ✅

## Problem Fixed

**Issue**: When a shipper clicked "Create Contract" after accepting a trucker's bid, the GCash payment modal opened for the shipper instead of the trucker. This was incorrect because the trucker should always pay the 5% platform fee, not the shipper.

**Root Cause**: The frontend `handleCreateContract` function immediately opened the payment modal for whoever clicked the button, without distinguishing between:
- **Listing owner** (who initiates contract creation by clicking button)
- **Platform fee payer** (trucker, who should actually pay)

## Solution Implemented

We've separated contract creation from payment initiation into a two-stage flow:

### Stage 1: Contract Creation (Initiated by Shipper/Listing Owner)
- Shipper clicks "Create Contract" after accepting a bid
- System creates contract with `status: 'pending_payment'`
- Notification sent to trucker: "Platform fee payment required"
- Shipper sees: "Contract created. Waiting for trucker to pay platform fee."

### Stage 2: Platform Fee Payment (Initiated by Trucker)
- Trucker sees contract in "My Contracts" with "Payment Required" badge
- Trucker clicks "Pay Platform Fee" button
- GCash payment modal opens for trucker
- After payment verified → Contract status changes to 'draft'
- Both parties can now sign the contract

---

## Files Modified

### Backend Changes

#### 1. **functions/src/api/contracts.js** ✅
**Changes**:
- Removed payment requirement check that blocked contract creation
- Allow contracts to be created with `status: 'pending_payment'` if fee not paid
- Determine platform fee payer (trucker) and store in contract
- Send appropriate notifications based on payment status

**Key Changes**:
```javascript
// Before: Required payment before creating contract
if (feeSnap.empty) {
  throw new functions.https.HttpsError(
    'failed-precondition',
    'Platform fee must be paid before creating contract'
  );
}

// After: Allow creation without payment
const isPlatformFeePaid = !feeSnap.empty;
const platformFeePayerId = isCargo ? bid.bidderId : listingOwnerId;

// Contract status based on payment
status: isPlatformFeePaid ? 'draft' : 'pending_payment',
platformFeePaid: isPlatformFeePaid,
platformFeePayerId,
```

**Notification Logic**:
- If paid: Notify both parties contract is ready to sign
- If not paid: Notify trucker to pay, notify shipper contract is waiting for payment

#### 2. **functions/index.js** ✅
**Changes**:
- Update `approvePayment` function to change contract status from `pending_payment` to `draft`
- Send notifications to both parties when payment is approved

**Key Changes**:
```javascript
// Update contract status when payment approved
await db.collection('contracts').doc(order.contractId).update({
  status: 'draft', // Change from pending_payment to draft
  platformFeePaid: true,
  platformFeeStatus: 'paid',
  platformFeePaidAt: admin.firestore.FieldValue.serverTimestamp(),
});

// Notify both parties
await db.collection(`users/${platformFeePayerId}/notifications`).doc().set({
  type: 'PAYMENT_VERIFIED',
  title: 'Platform Fee Paid ✅',
  message: `Your platform fee payment has been verified. The contract is now ready for signing.`,
});

await db.collection(`users/${listingOwnerId}/notifications`).doc().set({
  type: 'CONTRACT_READY',
  title: 'Contract Ready for Signing',
  message: `Contract platform fee has been paid. Please review and sign the contract.`,
});
```

---

### Frontend Changes

#### 3. **frontend/src/GetGoApp.jsx** ✅
**Changes**:
- Rewrote `handleCreateContract` to create contract via API instead of opening payment modal immediately
- Added logic to determine trucker (platform fee payer)
- Open payment modal only if current user IS the trucker (rare case)
- Show success toast and navigate to contracts view for shipper
- Created reusable `loadContracts` function for manual refresh

**Key Changes**:
```javascript
const handleCreateContract = async (bid, listing) => {
  try {
    setContractLoading(true);

    // Determine listing type and platform fee payer (trucker)
    const isCargo = !!listing.cargoType || listing.type === 'cargo';
    const truckerUserId = isCargo ? bid.bidderId : listing.userId;
    const currentUserId = authUser?.uid;

    // Create contract via API (will be in pending_payment status if fee not paid)
    const response = await api.contracts.create({
      bidId: bid.id,
    });

    const contract = response.contract;

    // Check if current user is the trucker (fee payer)
    if (truckerUserId === currentUserId) {
      // Rare case: trucker is creating the contract (e.g., truck listing)
      // Open payment modal immediately
      showToast({
        type: 'info',
        title: 'Platform Fee Required',
        message: 'Please pay the platform fee to activate your contract.',
      });

      const platformFee = contract.platformFee || Math.round(bid.price * 0.05);
      openModal('platformFee', { bid, listing, platformFee, contract });
    } else {
      // Normal case: shipper is creating contract, trucker needs to pay
      showToast({
        type: 'success',
        title: 'Contract Created',
        message: 'Contract created successfully. Waiting for trucker to pay platform fee.',
      });

      // Close the details modal and navigate to contracts view
      closeModal('cargoDetails');
      closeModal('truckDetails');
      setActiveTab('contracts');
    }

    // Refresh contracts list
    await loadContracts();

  } catch (error) {
    console.error('Error creating contract:', error);
    showToast({
      type: 'error',
      title: 'Error',
      message: error.message || 'Failed to create contract',
    });
  } finally {
    setContractLoading(false);
  }
};
```

#### 4. **frontend/src/components/modals/ContractModal.jsx** ✅
**Changes**:
- Added status style for `pending_payment` (orange badge)
- Added UI banner for `pending_payment` status with two views:
  - **Trucker view**: Prominent "Pay Platform Fee" button
  - **Shipper view**: "Awaiting Payment" message
- Added action button in footer for truckers to pay platform fee
- Hide signature section when status is `pending_payment`

**Key Changes**:
```javascript
// Added to statusStyles
const statusStyles = {
  pending_payment: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  draft: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  // ... other statuses
};

// Pending Payment Banner (added after status badge)
{contract.status === 'pending_payment' && (
  <div className="border-b border-gray-200 dark:border-gray-700">
    {isTrucker ? (
      // Trucker view: show payment button
      <div className="rounded-xl bg-gradient-to-br from-orange-50 to-orange-100">
        <h4>Platform Fee Payment Required</h4>
        <p>To activate this contract, please pay the 5% platform service fee of {formatPrice(contract.platformFee)}.</p>
        <Button onClick={() => onPayPlatformFee?.({ contractId: contract.id, bidId: contract.bidId, platformFee: contract.platformFee })}>
          Pay Platform Fee ({formatPrice(contract.platformFee)})
        </Button>
      </div>
    ) : (
      // Shipper view: show waiting message
      <div className="rounded-xl bg-gradient-to-br from-yellow-50 to-yellow-100">
        <h4>Awaiting Platform Fee Payment</h4>
        <p>Waiting for {truckerInfo?.name || 'the trucker'} to pay the platform fee of {formatPrice(contract.platformFee)}.</p>
      </div>
    )}
  </div>
)}

// Action button in footer
{contract.status === 'pending_payment' && isTrucker && (
  <Button onClick={() => onPayPlatformFee?.({ contractId: contract.id, bidId: contract.bidId, platformFee: contract.platformFee })}>
    Pay Platform Fee ({formatPrice(contract.platformFee)})
  </Button>
)}
```

---

## Data Flow Diagram

```
┌─────────────┐
│   SHIPPER   │ (Cargo Owner)
│ Accepts Bid │
└──────┬──────┘
       │ Clicks "Create Contract"
       ↓
┌────────────────────────────────┐
│ handleCreateContract()         │
│ - Determine trucker (fee payer)│
│ - Create contract via API      │
│   status: 'pending_payment'    │
│ - Show success toast           │
└────────────┬───────────────────┘
             │
             │ Notification sent
             ↓
        ┌─────────┐
        │ TRUCKER │ (Fee Payer)
        └────┬────┘
             │ Opens "My Contracts"
             │ Sees "Payment Required" badge
             │ Clicks contract
             ↓
    ┌────────────────────┐
    │ ContractModal      │
    │ Shows:             │
    │ "Pay Platform Fee" │
    │  button            │
    └────────┬───────────┘
             │ Clicks "Pay Platform Fee"
             ↓
    ┌────────────────────┐
    │ GCashPaymentModal  │
    │ - Show QR code     │
    │ - Upload screenshot│
    │ - Wait for verify  │
    └────────┬───────────┘
             │
             │ Admin approves payment
             ↓
    ┌────────────────────────┐
    │ approvePayment()       │
    │ - Update platformFees  │
    │ - Change status to     │
    │   'draft'              │
    │ - Notify both parties  │
    └────────┬───────────────┘
             │
             ↓
    ┌────────────────────────┐
    │ Both parties can now   │
    │ sign the contract      │
    └────────────────────────┘
```

---

## Contract Status Lifecycle

```
BID ACCEPTED
     ↓
┌─────────────────────┐
│ pending_payment     │ ← Contract created, waiting for trucker payment
│ - Trucker: Pay btn  │
│ - Shipper: Waiting  │
└──────────┬──────────┘
           │ Platform fee paid & verified
           ↓
┌─────────────────────┐
│ draft               │ ← Ready for signing
│ - Both: Sign button │
└──────────┬──────────┘
           │ Both parties sign
           ↓
┌─────────────────────┐
│ signed              │ ← Shipment tracking active
└─────────────────────┘
           ↓
      completed
```

---

## Notification Types

### 1. **Contract Created (Pending Payment)**

**To Trucker** (platform fee payer):
```json
{
  "type": "PLATFORM_FEE_REQUIRED",
  "title": "Platform Fee Payment Required",
  "message": "Contract #KC-XXXX created. Please pay ₱X platform fee to proceed.",
  "data": {
    "contractId": "...",
    "bidId": "...",
    "platformFee": 500
  }
}
```

**To Shipper** (listing owner):
```json
{
  "type": "CONTRACT_PENDING_PAYMENT",
  "title": "Contract Created",
  "message": "Contract #KC-XXXX created. Waiting for trucker to pay platform fee.",
  "data": {
    "contractId": "...",
    "bidId": "..."
  }
}
```

### 2. **Payment Verified (Contract Ready)**

**To Trucker** (fee payer):
```json
{
  "type": "PAYMENT_VERIFIED",
  "title": "Platform Fee Paid ✅",
  "message": "Your platform fee payment has been verified for Contract #KC-XXXX. The contract is now ready for signing.",
  "data": {
    "submissionId": "...",
    "contractId": "...",
    "bidId": "..."
  }
}
```

**To Shipper** (listing owner):
```json
{
  "type": "CONTRACT_READY",
  "title": "Contract Ready for Signing",
  "message": "Contract #KC-XXXX platform fee has been paid. Please review and sign the contract.",
  "data": {
    "contractId": "...",
    "bidId": "..."
  }
}
```

---

## Testing Checklist

### Cargo Listing Flow (Shipper → Trucker Payment)

- [x] Backend: contracts.js modified to allow pending_payment
- [x] Backend: approvePayment updates contract status to draft
- [x] Backend: Notifications sent to both parties
- [x] Frontend: handleCreateContract creates contract via API
- [x] Frontend: Shipper sees success toast, not payment modal
- [x] Frontend: ContractModal shows pending_payment UI
- [x] Frontend: Trucker sees "Pay Platform Fee" button
- [x] Frontend: Shipper sees "Awaiting Payment" message

### Manual Testing Steps

1. **Shipper creates cargo listing**
   - Login as shipper
   - Post cargo listing
   - Wait for trucker bid

2. **Trucker places bid**
   - Login as trucker
   - Place bid on cargo

3. **Shipper accepts bid**
   - Login as shipper
   - Accept trucker's bid
   - Click "Create Contract"
   - ✅ Verify NO payment modal opens for shipper
   - ✅ Verify toast: "Contract created. Waiting for trucker to pay platform fee."
   - ✅ Navigate to contracts view
   - ✅ Verify contract shows status "Pending Payment"

4. **Trucker pays platform fee**
   - Login as trucker
   - Go to "My Contracts"
   - ✅ Verify contract shows "Payment Required" badge
   - Click contract to open
   - ✅ Verify orange banner with "Pay Platform Fee" button
   - Click "Pay Platform Fee"
   - ✅ Verify GCash payment modal opens
   - Complete payment flow (upload screenshot)

5. **Admin approves payment**
   - Login as admin
   - Go to "Admin Dashboard" → "Payments"
   - Find payment submission
   - Click "Approve"
   - ✅ Verify contract status changes to "Draft"

6. **Both parties sign contract**
   - ✅ Verify both parties receive notification "Contract ready to sign"
   - ✅ Verify contract status is "Draft"
   - ✅ Verify signature section is visible
   - Both parties sign
   - ✅ Verify contract status changes to "Signed"
   - ✅ Verify shipment tracking is created

---

## Security Considerations

### 1. **Authorization Check** ✅
Backend verifies that only the trucker can pay the platform fee:
```javascript
// functions/src/api/wallet.js:68-71
if (truckerUserId !== userId) {
  throw new functions.https.HttpsError('permission-denied', 'Only the trucker can pay the platform fee');
}
```

### 2. **Payment Verification** ✅
Contract status only changes to 'draft' after admin approval:
```javascript
// functions/index.js:264-271
if (order.type === 'platform_fee') {
  await db.collection('contracts').doc(order.contractId).update({
    status: 'draft',
    platformFeePaid: true,
    platformFeeStatus: 'paid',
  });
}
```

### 3. **Prevent Double Payment** ✅
Check if platform fee already paid before creating order:
```javascript
// functions/src/api/wallet.js:77-88
const existingFeeSnap = await db.collection('platformFees')
  .where('bidId', '==', bidId)
  .where('status', '==', 'completed')
  .limit(1)
  .get();

if (!existingFeeSnap.empty) {
  throw new functions.https.HttpsError(
    'already-exists',
    'Platform fee already paid for this bid'
  );
}
```

---

## Rollback Plan

If issues arise after deployment:

1. **Database**: Old payment records in `platformFees` and `orders` collections remain valid
2. **Contracts**: Contracts in `pending_payment` status can be manually updated to `draft` via Firebase Console
3. **Backend**: Change is minimal - just removed payment requirement check, easy to revert
4. **Frontend**: Can revert `handleCreateContract` to open payment modal immediately

---

## Key Takeaways

### ✅ What Was Fixed
- Shippers no longer see payment modal when creating contracts
- Truckers receive notifications to pay platform fee
- Clear UI showing payment status for both parties
- Proper two-stage contract creation flow

### ✅ What Still Works
- Platform fee calculation (5% of agreed price)
- GCash payment verification system
- Contract signing flow
- Shipment tracking activation

### ✅ Edge Cases Handled
- Trucker creating contract (rare case): payment modal opens immediately
- Platform fee already paid: contract created with 'draft' status
- Payment verification failure: contract remains in 'pending_payment'
- Contract creation without bid acceptance: backend validation prevents this

---

## Next Steps for Deployment

1. **Test on staging environment**:
   - Run through complete cargo listing flow
   - Run through truck listing flow
   - Test notification system
   - Test mobile responsive UI

2. **Deploy backend functions**:
   ```bash
   cd functions
   firebase deploy --only functions
   ```

3. **Deploy frontend**:
   ```bash
   cd frontend
   npm run build
   firebase deploy --only hosting
   ```

4. **Monitor production**:
   - Check Firebase Functions logs
   - Monitor contract creation success rate
   - Monitor platform fee payment completion rate
   - Watch for user feedback

---

## Technical Notes

### Backend API Already Supports Contract Creation
The `createContract` API endpoint in `functions/src/api/contracts.js` was already well-structured and only needed minor modifications to:
- Remove the strict payment requirement check
- Add conditional status based on payment
- Add platform fee payer ID to contract

### Payment System Infrastructure Was Already in Place
The `createPlatformFeeOrder` API in `functions/src/api/wallet.js` already:
- Fetches the contract for the bid
- Stores contractId in the order
- The `approvePayment` function uses `order.contractId` to update the contract

This meant the fix was primarily about **separating the UX flow** rather than building new backend infrastructure.

---

## Credits

**Implementation Date**: February 10, 2026
**Implemented By**: Claude Sonnet 4.5
**Files Modified**: 4 files (2 backend, 2 frontend)
**Lines Changed**: ~200 lines total
**Issue Severity**: Critical UX Bug
**Status**: ✅ **FIXED**
