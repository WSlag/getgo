# Contract Signature Bug Fix

## Issue Summary
The contract signing flow had contradictory status messages:
- **Shipper's view**: Shows "Your Signature Needed" but clicking opens modal saying "Waiting for other party to sign"
- **Trucker's view**: Shows "Waiting for Other Party" but modal also says "Waiting for other party to sign"
- **Additional issue**: "Invalid Date" shown for signature timestamps

## Root Cause Analysis

### Bug #1: Incorrect Role Detection in ContractsView.jsx

**Location**: `frontend/src/views/ContractsView.jsx:145-156`

**Problem**: The `getSignatureStatus()` function incorrectly determined whether the current user was the shipper or trucker.

**Incorrect Logic** (line 148):
```javascript
const isShipper = isCargo ? isListingOwner : !isListingOwner;
```

This assumed that if the user is NOT the listing owner in a truck listing, they must be the shipper. However, this is wrong because:
- The user might not be a participant at all
- We need to explicitly check if they are the bidder

**Correct Logic**:
```javascript
const isBidder = currentUser?.id === contract.bidderId;
const isShipper = isCargo ? isListingOwner : isBidder;
```

This matches the backend logic in `backend/src/routes/contracts.js:345-353` and the modal logic in `frontend/src/components/modals/ContractModal.jsx:60-66`.

### Bug #2: Invalid Date Formatting

**Location**: `frontend/src/components/modals/ContractModal.jsx:90-99`

**Problem**: The `formatDateTime()` function didn't handle Firestore Timestamp objects properly, resulting in "Invalid Date" being displayed.

**Fix**: Added proper Firestore Timestamp handling:
```javascript
const formatDateTime = (dateStr) => {
  if (!dateStr) return '---';
  try {
    // Handle Firestore Timestamp objects
    const date = dateStr.toDate ? dateStr.toDate() : new Date(dateStr);
    if (isNaN(date.getTime())) return 'Invalid Date';
    return date.toLocaleString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (error) {
    console.error('Error formatting date:', error, dateStr);
    return 'Invalid Date';
  }
};
```

## Role Detection Logic (Reference)

### For Cargo Listings:
- **Shipper** = Listing Owner (the one who posted the cargo)
- **Trucker** = Bidder (the one who bid on the cargo)

### For Truck Listings:
- **Trucker** = Listing Owner (the one who posted the truck)
- **Shipper** = Bidder (the one who bid on the truck)

## Files Modified

1. **frontend/src/views/ContractsView.jsx**
   - Fixed `getSignatureStatus()` function to correctly identify user role
   - Added `isBidder` check instead of using `!isListingOwner`

2. **frontend/src/components/modals/ContractModal.jsx**
   - Enhanced `formatDateTime()` to handle Firestore Timestamps
   - Added error handling and validation

## Testing Recommendations

1. **Test as Shipper (Cargo Listing Owner)**:
   - Create a cargo listing
   - Accept a bid
   - Pay platform fee
   - Verify "Your Signature Needed" shows in list
   - Click contract and verify you can sign
   - After signing, verify "Waiting for Other Party" shows

2. **Test as Trucker (Cargo Listing Bidder)**:
   - Bid on a cargo listing
   - Wait for acceptance and platform fee payment
   - Verify "Your Signature Needed" shows in list
   - Sign the contract
   - Verify timestamp displays correctly (not "Invalid Date")

3. **Test as Trucker (Truck Listing Owner)**:
   - Post a truck listing
   - Accept a bid
   - Verify correct signature status

4. **Test as Shipper (Truck Listing Bidder)**:
   - Bid on a truck listing
   - Wait for acceptance
   - Verify correct signature status

## Expected Behavior After Fix

1. ✅ Shipper sees "Your Signature Needed" when they haven't signed
2. ✅ Trucker sees "Your Signature Needed" when they haven't signed
3. ✅ After signing, user sees "Waiting for Other Party"
4. ✅ After both sign, contract moves to "Active" status
5. ✅ Signature timestamps display correctly (e.g., "Jan 15, 2026, 2:30 PM")

## Contract Status Flow

```
Draft → Shipper Signs → Still Draft (waiting for trucker)
     → Trucker Signs → Still Draft (waiting for shipper)
     → Both Sign → Signed (Active) → Shipment Created
```
