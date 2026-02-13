/**
 * Contract Creation Service
 * Reusable service for creating contracts from approved platform fee payments
 */

const admin = require('firebase-admin');

const PLATFORM_FEE_RATE = 0.05; // 5%
const UNVERIFIED_OUTSTANDING_CAP = 2000;
const NEW_ACCOUNT_OUTSTANDING_CAP = 3000;
const STANDARD_OUTSTANDING_CAP = 5000;
const NEW_ACCOUNT_DAYS = 30;

function resolveOutstandingCap(userData = {}) {
  const createdAt = userData.createdAt?.toDate ? userData.createdAt.toDate() : null;
  const accountAgeDays = createdAt
    ? Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24))
    : 0;
  const isNewAccount = accountAgeDays < NEW_ACCOUNT_DAYS;
  const isVerified = userData.isVerified === true;

  let cap = STANDARD_OUTSTANDING_CAP;
  if (!isVerified) cap = Math.min(cap, UNVERIFIED_OUTSTANDING_CAP);
  if (isNewAccount) cap = Math.min(cap, NEW_ACCOUNT_OUTSTANDING_CAP);

  return { cap, isVerified, isNewAccount, accountAgeDays };
}

// Helper: Generate unique contract number
function generateContractNumber() {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `KC-${year}${month}-${random}`;
}

// Helper: Fetch bid and listing data from Firestore
async function getFirestoreBidData(bidId) {
  const db = admin.firestore();
  const bidDoc = await db.collection('bids').doc(bidId).get();
  if (!bidDoc.exists) return null;

  const bid = { id: bidDoc.id, ...bidDoc.data() };

  // Fetch the listing from Firestore
  let listing = null;
  let isCargo = false;
  if (bid.cargoListingId) {
    const listingDoc = await db.collection('cargoListings').doc(bid.cargoListingId).get();
    if (listingDoc.exists) {
      listing = { id: listingDoc.id, ...listingDoc.data() };
      isCargo = true;
    }
  } else if (bid.truckListingId) {
    const listingDoc = await db.collection('truckListings').doc(bid.truckListingId).get();
    if (listingDoc.exists) {
      listing = { id: listingDoc.id, ...listingDoc.data() };
    }
  }

  return { bid, listing, isCargo };
}

/**
 * Create Contract from Approved Platform Fee Payment
 * Called when a platform fee payment is approved (auto or admin)
 * OR when bid is accepted (with skipPaymentCheck flag)
 *
 * @param {string} bidId - The bid ID
 * @param {string} userId - User ID (listing owner)
 * @param {object} options - Optional contract data overrides
 * @param {boolean} options.skipPaymentCheck - Skip payment verification (for deferred payment)
 * @param {boolean} options.createPlatformFeeDebt - Create outstanding platform fee debt
 * @returns {Promise<object>} - Created contract data
 */
async function createContractFromApprovedFee(bidId, userId, options = {}) {
  const { skipPaymentCheck: _skipPaymentCheck = false, createPlatformFeeDebt = false } = options;
  const db = admin.firestore();

  // Fetch bid and listing from Firestore
  const bidData = await getFirestoreBidData(bidId);
  if (!bidData || !bidData.bid) {
    throw new Error('Bid not found');
  }

  const { bid, listing, isCargo } = bidData;

  if (!listing) {
    throw new Error('Listing not found');
  }

  if (bid.status !== 'accepted' && bid.status !== 'contracted') {
    throw new Error('Bid must be accepted before creating a contract');
  }

  // Check if contract already exists for this bid
  const existingContractSnap = await db.collection('contracts')
    .where('bidId', '==', bidId)
    .limit(1)
    .get();

  if (!existingContractSnap.empty) {
    // Contract already exists, return it
    const existingDoc = existingContractSnap.docs[0];
    return { id: existingDoc.id, ...existingDoc.data() };
  }

  const listingOwnerId = listing.userId;

  // Verify userId matches listing owner
  if (listingOwnerId !== userId) {
    throw new Error('Only the listing owner can create the contract');
  }

  const platformFee = Math.round(bid.price * PLATFORM_FEE_RATE);
  const declaredCargoValue = options.declaredCargoValue || 100000;

  // Build default terms
  const defaultTerms = `
KARGA FREIGHT TRANSPORTATION CONTRACT

This Contract is entered into between the Shipper and Trucker through the Karga platform.

1. TRANSPORTATION SERVICES
The Trucker agrees to transport cargo from ${listing.origin} to ${listing.destination}.

2. CARGO LIABILITY
- Maximum liability: PHP ${declaredCargoValue.toLocaleString()} (Declared Value)
- Trucker exercises extraordinary diligence per Philippine Civil Code
- Exceptions: Force majeure, shipper's fault, inherent defect

3. PAYMENT TERMS
- Freight Rate: PHP ${Number(bid.price).toLocaleString()}
- Platform Service Fee: PHP ${platformFee.toLocaleString()} (${(PLATFORM_FEE_RATE * 100).toFixed(0)}%) - Payable by Trucker within 3 days after delivery completion
- Payment Method: Direct payment from Shipper to Trucker
- Payment Schedule: As agreed between parties (COD, advance, or partial)

4. OBLIGATIONS
Shipper: Accurate cargo info, proper packaging, timely payment to Trucker
Trucker: Safe transport, communication, timely delivery

5. DISPUTE RESOLUTION
Negotiation (7 days) → Mediation (14 days) → Arbitration per RA 9285

6. PLATFORM DISCLAIMER
Karga is a technology platform only, NOT a party to this contract.
Karga has no liability for cargo loss, damage, payment disputes, or other issues between parties.

7. GOVERNING LAW
Republic of the Philippines

By signing, both parties agree to these terms.
  `.trim();

  const contractNumber = generateContractNumber();
  const participantIds = [listingOwnerId, bid.bidderId];

  // Determine who owes the platform fee (trucker)
  const platformFeePayerId = isCargo ? bid.bidderId : listingOwnerId;

  let capProfile = null;
  let currentOutstanding = 0;
  if (createPlatformFeeDebt) {
    const payerDoc = await db.collection('users').doc(platformFeePayerId).get();
    if (!payerDoc.exists) {
      throw new Error('Platform fee payer not found');
    }

    const payer = payerDoc.data() || {};
    if (payer.accountStatus === 'suspended' || payer.isActive === false) {
      throw new Error('Platform fee payer account is restricted');
    }

    currentOutstanding = Number(payer.outstandingPlatformFees || 0);
    capProfile = resolveOutstandingCap(payer);
    const projectedOutstanding = currentOutstanding + platformFee;
    if (projectedOutstanding > capProfile.cap) {
      throw new Error(
        `Outstanding platform fee cap exceeded (${projectedOutstanding} > ${capProfile.cap})`
      );
    }
  }

  // Create contract in Firestore
  const contractRef = db.collection('contracts').doc();
  const contractData = {
    bidId,
    contractNumber,
    agreedPrice: bid.price,
    platformFee,

    // Platform fee tracking fields
    platformFeePaid: createPlatformFeeDebt ? false : true,
    platformFeeStatus: createPlatformFeeDebt ? 'outstanding' : 'paid',
    platformFeeDueDate: null,
    platformFeeBillingStartedAt: null,
    platformFeeOrderId: null,
    platformFeePaidAt: createPlatformFeeDebt ? null : admin.firestore.FieldValue.serverTimestamp(),
    platformFeeReminders: [],
    platformFeePayerId,
    platformFeeDebtCap: capProfile?.cap || STANDARD_OUTSTANDING_CAP,
    platformFeeOutstandingAtCreation: createPlatformFeeDebt ? currentOutstanding : 0,

    declaredCargoValue,
    pickupDate: options.pickupDate || listing.pickupDate || listing.availableDate || null,
    pickupAddress: listing.origin,
    deliveryAddress: listing.destination,
    expectedDeliveryDate: options.expectedDeliveryDate || null,
    cargoType: isCargo ? listing.cargoType : (bid.cargoType || 'General'),
    cargoWeight: isCargo ? listing.weight : (bid.cargoWeight || 0),
    cargoWeightUnit: isCargo ? listing.weightUnit : 'tons',
    cargoDescription: listing.description || '',
    specialInstructions: options.specialInstructions || '',
    vehicleType: isCargo ? listing.vehicleNeeded : listing.vehicleType,
    vehiclePlateNumber: isCargo ? '' : (listing.plateNumber || ''),
    terms: options.terms || defaultTerms,
    liabilityAcknowledged: options.liabilityAcknowledged || false,
    status: 'draft',
    listingType: isCargo ? 'cargo' : 'truck',
    listingId: listing.id,
    listingOwnerId,
    bidderId: bid.bidderId,
    bidderName: bid.bidderName || '',
    listingOwnerName: listing.userName || bid.listingOwnerName || '',
    participantIds,
    shipperSignature: null,
    truckerSignature: null,
    shipperSignedAt: null,
    truckerSignedAt: null,
    signedAt: null,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await contractRef.set(contractData);

  // Track outstanding fees if creating platform fee debt
  if (createPlatformFeeDebt) {
    await db.collection('users').doc(platformFeePayerId).update({
      outstandingPlatformFees: admin.firestore.FieldValue.increment(platformFee),
      outstandingFeeContracts: admin.firestore.FieldValue.arrayUnion(contractRef.id),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  // Update listing status
  const listingCollection = isCargo ? 'cargoListings' : 'truckListings';
  await db.collection(listingCollection).doc(listing.id).update({
    status: 'contracted',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Update bid status to contracted
  await db.collection('bids').doc(bidId).update({
    status: 'contracted',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Create notification for bidder
  await db.collection(`users/${bid.bidderId}/notifications`).doc().set({
    type: 'CONTRACT_READY',
    title: 'Contract Ready for Signing',
    message: `Contract #${contractNumber} is ready for your signature. Please review the terms and sign to proceed.`,
    data: { contractId: contractRef.id, bidId },
    isRead: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Create notification for listing owner
  await db.collection(`users/${listingOwnerId}/notifications`).doc().set({
    type: 'CONTRACT_CREATED',
    title: 'Contract Created Successfully',
    message: `Contract #${contractNumber} has been created. Please review and sign to proceed.`,
    data: { contractId: contractRef.id, bidId },
    isRead: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { id: contractRef.id, ...contractData };
}

module.exports = {
  createContractFromApprovedFee,
};
