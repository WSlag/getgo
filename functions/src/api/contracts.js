/**
 * Contract Management Cloud Functions
 * Handles contract creation, signing, and completion
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const {
  loadPlatformSettings,
  calculatePlatformFeeAmount,
  shouldBlockForMaintenance,
} = require('../config/platformSettings');
const {
  ACTIVITY_TYPES,
  getBrokerReferralForUser,
  mapListingTypeToTypeBucket,
  maskDisplayName,
  upsertBrokerMarketplaceActivity,
} = require('../services/brokerListingReferralService');
const { enforceUserRateLimit } = require('../utils/callableRateLimit');
const { parseTrustedStorageUrl } = require('../utils/storageUrl');
const PLATFORM_FEE_DEBT_CAP = Number(process.env.PLATFORM_FEE_DEBT_CAP || 15000);
const TRUCKER_CANCELLATION_THRESHOLD = 5;
const TRUCKER_CANCELLATION_WINDOW_DAYS = 30;
const TRUCKER_CANCELLATION_BLOCK_DAYS = 7;

const TRUCKER_CANCELLATION_REASON_LABELS = {
  vehicle_breakdown: 'Vehicle breakdown',
  emergency_health: 'Emergency/Health',
  route_safety_risk: 'Route/Safety risk',
  schedule_conflict: 'Schedule conflict',
  payment_terms_issue: 'Payment/Terms issue',
  other: 'Other',
};

function toDateValue(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === 'function') return value.toDate();
  if (typeof value.seconds === 'number') return new Date(value.seconds * 1000);
  if (typeof value._seconds === 'number') return new Date(value._seconds * 1000);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function startOfRollingWindow(referenceDate, days) {
  const result = new Date(referenceDate);
  result.setDate(result.getDate() - days);
  return result;
}

function normalizeReasonCode(reasonCode) {
  return typeof reasonCode === 'string' ? reasonCode.trim().toLowerCase() : '';
}

function resolveTruckerCancellationReasonLabel(reasonCode) {
  return TRUCKER_CANCELLATION_REASON_LABELS[reasonCode] || null;
}

function resolveTruckerDocumentFieldName(docType) {
  if (docType === 'driver') return 'driverLicenseCopy';
  if (docType === 'lto') return 'ltoRegistrationCopy';
  return null;
}

function validateTruckerDocumentMetadata(doc, userId, requiredDocType) {
  if (!doc || typeof doc !== 'object') {
    return { valid: false, reason: `${requiredDocType}_missing` };
  }

  const url = typeof doc.url === 'string' ? doc.url.trim() : '';
  const path = typeof doc.path === 'string' ? doc.path.trim() : '';

  if (!url || !path) {
    return { valid: false, reason: `${requiredDocType}_missing_path_or_url` };
  }

  const expectedPrefix = requiredDocType === 'driver'
    ? `trucker-docs/${userId}/driver_license/`
    : (requiredDocType === 'lto' ? `trucker-docs/${userId}/lto_registration/` : `trucker-docs/${userId}/`);

  if (!path.startsWith(expectedPrefix)) {
    return { valid: false, reason: `${requiredDocType}_owner_mismatch` };
  }

  const parsedStorage = parseTrustedStorageUrl(url);
  if (!parsedStorage.valid) {
    return { valid: false, reason: `${requiredDocType}_${parsedStorage.reason}` };
  }

  if (parsedStorage.objectPath !== path) {
    return { valid: false, reason: `${requiredDocType}_path_mismatch` };
  }

  return { valid: true, reason: null };
}

async function getAdminUserIds(db) {
  const [adminsByRole, adminsByFlag] = await Promise.all([
    db.collection('users').where('role', '==', 'admin').limit(200).get(),
    db.collection('users').where('isAdmin', '==', true).limit(200).get(),
  ]);

  const recipients = new Set();
  adminsByRole.docs.forEach((doc) => recipients.add(doc.id));
  adminsByFlag.docs.forEach((doc) => recipients.add(doc.id));
  return [...recipients];
}

function getTruckerComplianceRef(db, truckerId) {
  return db.collection('users').doc(truckerId).collection('truckerCompliance').doc('profile');
}

// Helper: Generate unique contract number
function generateContractNumber() {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `KC-${year}${month}-${random}`;
}

// Helper: Generate unique tracking number
function generateTrackingNumber() {
  const random = Math.random().toString(36).substring(2, 10).toUpperCase();
  return `TRK-${random}`;
}

/**
 * Compose full address from city + street address
 * @param {string} city - City name (e.g., "Davao City")
 * @param {string} streetAddress - Street-level details (e.g., "123 Main St, Bldg A")
 * @returns {string} Full address or city if no street address
 */
function composeFullAddress(city, streetAddress) {
  if (!streetAddress || streetAddress.trim() === '') {
    return city;  // Fallback to city-only for old listings
  }
  return `${streetAddress}, ${city}`;
}

function shouldCountContractAsOutstandingFee(contract = {}) {
  if (contract.platformFeePaid === true) return false;
  if (Number(contract.platformFee || 0) <= 0) return false;
  if (contract.status === 'cancelled') return false;
  if (contract.platformFeeStatus === 'waived') return false;
  return true;
}

async function reconcilePlatformFeePayerAccount(db, feePayerId) {
  if (!feePayerId) return null;

  const [payerDoc, unpaidContractsSnap] = await Promise.all([
    db.collection('users').doc(feePayerId).get(),
    db.collection('contracts')
      .where('platformFeePayerId', '==', feePayerId)
      .where('platformFeePaid', '==', false)
      .get(),
  ]);

  if (!payerDoc.exists) return null;

  const payableContracts = unpaidContractsSnap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter(shouldCountContractAsOutstandingFee);

  const recalculatedOutstanding = payableContracts.reduce(
    (sum, activeContract) => sum + Number(activeContract.platformFee || 0),
    0
  );
  const outstandingContractIds = payableContracts.map((activeContract) => activeContract.id);

  const payerData = payerDoc.data() || {};
  const shouldUnsuspend = (
    payerData.accountStatus === 'suspended' &&
    payerData.suspensionReason === 'unpaid_platform_fees' &&
    recalculatedOutstanding <= 0
  );

  const payerUpdates = {
    outstandingPlatformFees: recalculatedOutstanding,
    outstandingFeeContracts: outstandingContractIds,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (shouldUnsuspend) {
    payerUpdates.accountStatus = 'active';
    payerUpdates.suspensionReason = null;
    payerUpdates.suspendedAt = null;
    payerUpdates.unsuspendedAt = admin.firestore.FieldValue.serverTimestamp();
  }

  await db.collection('users').doc(feePayerId).update(payerUpdates);

  return {
    feePayerId,
    shouldUnsuspend,
    recalculatedOutstanding,
  };
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

function resolveContractActivityType(listingType, phase) {
  if (String(listingType || '').toLowerCase() === 'cargo') {
    if (phase === 'created') return ACTIVITY_TYPES.CARGO_CONTRACT_CREATED;
    if (phase === 'signed') return ACTIVITY_TYPES.CARGO_CONTRACT_SIGNED;
    if (phase === 'completed') return ACTIVITY_TYPES.CARGO_CONTRACT_COMPLETED;
    return ACTIVITY_TYPES.CARGO_CONTRACT_CANCELLED;
  }
  if (phase === 'created') return ACTIVITY_TYPES.TRUCK_BOOKING_CONTRACT_CREATED;
  if (phase === 'signed') return ACTIVITY_TYPES.TRUCK_BOOKING_CONTRACT_SIGNED;
  if (phase === 'completed') return ACTIVITY_TYPES.TRUCK_BOOKING_CONTRACT_COMPLETED;
  return ACTIVITY_TYPES.TRUCK_BOOKING_CONTRACT_CANCELLED;
}

function resolveContractActivityStatus(phase) {
  if (phase === 'signed') return 'accepted';
  if (phase === 'completed') return 'completed';
  if (phase === 'cancelled') return 'cancelled';
  return 'pending';
}

async function recordTruckBookingContractActivity(db, contractId, contract, phase) {
  if (!contract || !contract.bidderId) return;
  const listingType = String(contract.listingType || '').toLowerCase() === 'cargo' ? 'cargo' : 'truck';

  const referral = await getBrokerReferralForUser(contract.bidderId, db);
  if (!referral?.brokerId) return;

  const [referredDoc, counterpartyDoc] = await Promise.all([
    db.collection('users').doc(contract.bidderId).get(),
    contract.listingOwnerId ? db.collection('users').doc(contract.listingOwnerId).get() : Promise.resolve(null),
  ]);

  await upsertBrokerMarketplaceActivity(`contract:${contractId}:${phase}`, {
    brokerId: referral.brokerId,
    referredUserId: contract.bidderId,
    activityType: resolveContractActivityType(listingType, phase),
    listingType,
    listingId: contract.listingId || null,
    bidId: contract.bidId || null,
    contractId,
    amount: Number(contract.agreedPrice || 0) || null,
    origin: contract.pickupCity || contract.pickupAddress || null,
    destination: contract.deliveryCity || contract.deliveryAddress || null,
    status: resolveContractActivityStatus(phase),
    statusBucket: resolveContractActivityStatus(phase),
    typeBucket: mapListingTypeToTypeBucket(listingType),
    activityAt: admin.firestore.FieldValue.serverTimestamp(),
    referredUserMasked: maskDisplayName(referredDoc.exists ? referredDoc.data().name : null, referredDoc.exists ? referredDoc.data().phone : null),
    counterpartyMasked: maskDisplayName(counterpartyDoc?.exists ? counterpartyDoc.data().name : contract.listingOwnerName, counterpartyDoc?.exists ? counterpartyDoc.data().phone : null),
    source: 'trigger',
  }, db);
}

/**
 * Create Contract from Accepted Bid
 */
exports.createContract = functions.region('asia-southeast1').https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  const { bidId, declaredCargoValue, pickupDate, expectedDeliveryDate, specialInstructions, liabilityAcknowledged, terms } = data;
  const userId = context.auth.uid;

  if (!bidId) {
    throw new functions.https.HttpsError('invalid-argument', 'Bid ID is required');
  }

  const db = admin.firestore();
  await enforceUserRateLimit({
    db,
    userId,
    operation: 'createContract',
    maxAttempts: 10,
    windowMs: 60 * 1000,
  });
  const platformSettings = await loadPlatformSettings(db);
  if (shouldBlockForMaintenance(platformSettings, context.auth?.token)) {
    throw new functions.https.HttpsError('failed-precondition', 'Platform is currently under maintenance');
  }

  // Fetch bid and listing from Firestore
  const bidData = await getFirestoreBidData(bidId);
  if (!bidData || !bidData.bid) {
    throw new functions.https.HttpsError('not-found', 'Bid not found');
  }

  const { bid, listing, isCargo } = bidData;

  if (!listing) {
    throw new functions.https.HttpsError('not-found', 'Listing not found');
  }

  if (bid.status !== 'accepted') {
    throw new functions.https.HttpsError('failed-precondition', 'Bid must be accepted before creating a contract');
  }

  // Check if contract already exists for this bid
  const existingContractSnap = await db.collection('contracts')
    .where('bidId', '==', bidId)
    .limit(1)
    .get();
  if (!existingContractSnap.empty) {
    throw new functions.https.HttpsError('already-exists', 'Contract already exists for this bid');
  }

  const listingOwnerId = listing.userId;

  // Only listing owner can create contract
  if (listingOwnerId !== userId) {
    throw new functions.https.HttpsError('permission-denied', 'Only the listing owner can create the contract');
  }

  const platformFee = calculatePlatformFeeAmount(bid.price, platformSettings);
  const feePercent = Number(platformSettings?.platformFee?.percentage || 5);

  // Determine who is the trucker (platform fee payer)
  const platformFeePayerId = isCargo ? bid.bidderId : listingOwnerId;

  if (platformFeePayerId) {
    const payerDoc = await db.collection('users').doc(platformFeePayerId).get();
    const payerData = payerDoc.exists ? (payerDoc.data() || {}) : {};
    const outstanding = Number(payerData.outstandingPlatformFees || 0);
    if (outstanding >= PLATFORM_FEE_DEBT_CAP) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Platform fee debt cap reached. Settle due platform fees before creating or signing new jobs.',
        {
          reason: 'platform-fee-cap-reached',
          outstanding,
          debtCap: PLATFORM_FEE_DEBT_CAP,
          feePayerId: platformFeePayerId,
        }
      );
    }
  }

  // Build default terms
  const defaultTerms = `
KARGA FREIGHT TRANSPORTATION CONTRACT

This Contract is entered into between the Shipper and Trucker through the Karga platform.

1. TRANSPORTATION SERVICES
The Trucker agrees to transport cargo from:
  Pickup: ${composeFullAddress(listing.origin, listing.originStreetAddress)}
  Delivery: ${composeFullAddress(listing.destination, listing.destinationStreetAddress)}

2. CARGO LIABILITY
- Maximum liability: PHP ${(declaredCargoValue || 100000).toLocaleString()} (Declared Value)
- Trucker exercises extraordinary diligence per Philippine Civil Code
- Exceptions: Force majeure, shipper's fault, inherent defect

3. PAYMENT TERMS
- Freight Rate: PHP ${Number(bid.price).toLocaleString()}
- Platform Service Fee: PHP ${platformFee.toLocaleString()} (${feePercent.toFixed(2).replace(/\.00$/, '')}%) - Payable by Trucker within 3 days of confirmed delivery
- Payment Method: Direct payment from Shipper to Trucker
- Payment Schedule: As agreed between parties (COD, advance, or partial)
- Late Payment: If total unpaid platform fees reach PHP 15,000, new job creation and contract signing are restricted until payment is settled

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
  const shipperId = isCargo ? listingOwnerId : bid.bidderId;
  const truckerId = isCargo ? bid.bidderId : listingOwnerId;

  // Create contract in Firestore
  const contractRef = db.collection('contracts').doc();
  const contractData = {
    bidId,
    contractNumber,
    agreedPrice: bid.price,
    platformFee,
    platformFeePercentage: feePercent,
    declaredCargoValue: declaredCargoValue || listing.declaredValue || 100000,
    pickupDate: pickupDate || listing.pickupDate || listing.availableDate || null,
    pickupAddress: composeFullAddress(listing.origin, listing.originStreetAddress),
    pickupCity: listing.origin,
    pickupStreetAddress: listing.originStreetAddress || '',
    deliveryAddress: composeFullAddress(listing.destination, listing.destinationStreetAddress),
    deliveryCity: listing.destination,
    deliveryStreetAddress: listing.destinationStreetAddress || '',
    expectedDeliveryDate: expectedDeliveryDate || null,
    cargoType: isCargo ? listing.cargoType : (bid.cargoType || 'General'),
    cargoWeight: isCargo ? listing.weight : (bid.cargoWeight || 0),
    cargoWeightUnit: isCargo ? listing.weightUnit : 'tons',
    cargoDescription: listing.description || '',
    specialInstructions: specialInstructions || '',
    vehicleType: isCargo ? listing.vehicleNeeded : listing.vehicleType,
    vehiclePlateNumber: isCargo ? '' : (listing.plateNumber || ''),
    terms: terms || defaultTerms,
    liabilityAcknowledged: liabilityAcknowledged || false,
    status: 'draft',
    platformFeePaid: false,
    platformFeeStatus: 'outstanding',
    platformFeeDueDate: null,
    platformFeeBillingStartedAt: null,
    platformFeeReminders: [],
    platformFeePayerId,
    listingType: isCargo ? 'cargo' : 'truck',
    listingId: listing.id,
    listingOwnerId,
    bidderId: bid.bidderId,
    bidderName: bid.bidderName || '',
    listingOwnerName: listing.userName || bid.listingOwnerName || '',
    shipperId,
    truckerId,
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

  // Update listing status
  const listingCollection = isCargo ? 'cargoListings' : 'truckListings';
  await db.collection(listingCollection).doc(listing.id).update({
    status: 'contracted',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Update bid status
  await db.collection('bids').doc(bidId).update({
    status: 'contracted',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Create notifications for both parties
  await db.collection(`users/${bid.bidderId}/notifications`).doc().set({
    type: 'CONTRACT_READY',
    title: 'Contract Ready for Review',
    message: `Contract #${contractNumber} is ready for your review. Please sign to activate. Platform fee of PHP ${platformFee.toLocaleString()} will be due 3 days after delivery confirmation.`,
    data: { contractId: contractRef.id, bidId },
    isRead: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  await db.collection(`users/${listingOwnerId}/notifications`).doc().set({
    type: 'CONTRACT_READY',
    title: 'Contract Ready for Review',
    message: `Contract #${contractNumber} is ready for your review. Please sign to proceed.`,
    data: { contractId: contractRef.id, bidId },
    isRead: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  try {
    await recordTruckBookingContractActivity(db, contractRef.id, { ...contractData }, 'created');
  } catch (activityError) {
    console.error('Failed to record truck booking contract created activity:', activityError);
  }

  return {
    message: 'Contract created successfully',
    contract: { id: contractRef.id, ...contractData },
  };
});

/**
 * Sign Contract
 */
exports.signContract = functions.region('asia-southeast1').https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  const { contractId, truckPlateNumber } = data || {};
  const userId = context.auth.uid;

  if (!contractId) {
    throw new functions.https.HttpsError('invalid-argument', 'Contract ID is required');
  }

  const db = admin.firestore();
  await enforceUserRateLimit({
    db,
    userId,
    operation: 'signContract',
    maxAttempts: 10,
    windowMs: 60 * 1000,
  });
  const platformSettings = await loadPlatformSettings(db);
  if (shouldBlockForMaintenance(platformSettings, context.auth?.token)) {
    throw new functions.https.HttpsError('failed-precondition', 'Platform is currently under maintenance');
  }

  // Fetch contract
  const contractDoc = await db.collection('contracts').doc(contractId).get();
  if (!contractDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Contract not found');
  }

  const contract = { id: contractDoc.id, ...contractDoc.data() };

  const listingOwnerId = contract.listingOwnerId;
  const bidderId = contract.bidderId;
  const isCargo = contract.listingType === 'cargo';
  const shipperId = contract.shipperId || (isCargo ? listingOwnerId : bidderId);
  const truckerId = contract.truckerId || (isCargo ? bidderId : listingOwnerId);
  const feePayerId = contract.platformFeePayerId || truckerId;

  if (!contract.platformFeePaid && feePayerId) {
    const payerDoc = await db.collection('users').doc(feePayerId).get();
    const payerData = payerDoc.exists ? (payerDoc.data() || {}) : {};
    const outstanding = Number(payerData.outstandingPlatformFees || 0);
    if (outstanding >= PLATFORM_FEE_DEBT_CAP) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Platform fee debt cap reached. Settle due platform fees before creating or signing new jobs.',
        {
          reason: 'platform-fee-cap-reached',
          outstanding,
          debtCap: PLATFORM_FEE_DEBT_CAP,
          feePayerId,
          contractId,
        }
      );
    }
  }

  // Determine if user is shipper or trucker
  let isShipper, isTrucker;
  if (isCargo) {
    isShipper = listingOwnerId === userId;
    isTrucker = bidderId === userId;
  } else {
    isTrucker = listingOwnerId === userId;
    isShipper = bidderId === userId;
  }

  if (!isShipper && !isTrucker) {
    throw new functions.https.HttpsError('permission-denied', 'Not authorized to sign this contract');
  }

  const callerAlreadySigned = isShipper ? !!contract.shipperSignature : !!contract.truckerSignature;
  const contractAlreadyFullySigned = !!(contract.shipperSignature && contract.truckerSignature);

  // Idempotent behavior: treat repeated sign attempts by the same participant as success.
  if (contract.status === 'signed' || contract.status === 'completed') {
    if (callerAlreadySigned) {
      return {
        message: 'Contract already signed by this user',
        contract,
        fullyExecuted: contractAlreadyFullySigned,
        alreadySigned: true,
      };
    }
    throw new functions.https.HttpsError('failed-precondition', 'Contract has already been signed');
  }

  if (callerAlreadySigned) {
    return {
      message: 'Contract already signed by this user',
      contract,
      fullyExecuted: contractAlreadyFullySigned,
      alreadySigned: true,
    };
  }

  const updates = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };

  if (isTrucker) {
    const complianceRef = getTruckerComplianceRef(db, truckerId);
    const truckerProfileRef = db.collection('users').doc(truckerId).collection('truckerProfile').doc('profile');
    const [complianceDoc, truckerProfileDoc] = await Promise.all([
      complianceRef.get(),
      truckerProfileRef.get(),
    ]);
    const complianceData = complianceDoc.exists ? (complianceDoc.data() || {}) : {};
    const truckerProfile = truckerProfileDoc.exists ? (truckerProfileDoc.data() || {}) : {};
    const now = new Date();
    const blockUntilDate = toDateValue(complianceData.cancellationBlockUntil);

    if (blockUntilDate && now.getTime() < blockUntilDate.getTime()) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Trucker cancellation threshold reached. Contract signing is temporarily blocked.',
        {
          reason: 'trucker-cancellation-limit-reached',
          blockUntil: blockUntilDate.toISOString(),
          threshold: TRUCKER_CANCELLATION_THRESHOLD,
          windowDays: TRUCKER_CANCELLATION_WINDOW_DAYS,
        }
      );
    }

    if (blockUntilDate && now.getTime() >= blockUntilDate.getTime()) {
      await complianceRef.set({
        cancellationBlockUntil: null,
        cancellationBlockedAt: null,
        cancellationBlockReason: null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

      await db.collection('adminLogs').add({
        action: 'SYSTEM_TRUCKER_CANCELLATION_BLOCK_CLEARED',
        targetUserId: truckerId,
        performedBy: 'system',
        performedAt: admin.firestore.FieldValue.serverTimestamp(),
        previousBlockUntil: blockUntilDate.toISOString(),
      });
    }

    const docsRequiredOnSigning = complianceData.docsRequiredOnSigning !== false;
    if (docsRequiredOnSigning) {
      const missingDocs = [];
      const driverValidation = validateTruckerDocumentMetadata(truckerProfile.driverLicenseCopy, truckerId, 'driver');
      const ltoValidation = validateTruckerDocumentMetadata(truckerProfile.ltoRegistrationCopy, truckerId, 'lto');

      if (!driverValidation.valid) {
        missingDocs.push({ field: resolveTruckerDocumentFieldName('driver'), reason: driverValidation.reason });
      }
      if (!ltoValidation.valid) {
        missingDocs.push({ field: resolveTruckerDocumentFieldName('lto'), reason: ltoValidation.reason });
      }

      if (missingDocs.length > 0) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'Required trucker documents are missing or invalid.',
          {
            reason: 'missing-required-trucker-documents',
            missingDocs,
          }
        );
      }
    }

    const windowStart = startOfRollingWindow(now, TRUCKER_CANCELLATION_WINDOW_DAYS);
    const resetAt = toDateValue(complianceData.cancellationResetAt);
    const baselineDate = resetAt && resetAt.getTime() > windowStart.getTime()
      ? resetAt
      : windowStart;
    const cancellationCountSnap = await db.collection('contracts')
      .where('truckerId', '==', truckerId)
      .where('cancelledByRole', '==', 'trucker')
      .where('cancelledAt', '>=', admin.firestore.Timestamp.fromDate(baselineDate))
      .count()
      .get();
    const cancellationCount = Number(cancellationCountSnap?.data()?.count || 0);

    if (cancellationCount >= TRUCKER_CANCELLATION_THRESHOLD) {
      const blockUntil = new Date(now);
      blockUntil.setDate(blockUntil.getDate() + TRUCKER_CANCELLATION_BLOCK_DAYS);

      await complianceRef.set({
        cancellationBlockUntil: admin.firestore.Timestamp.fromDate(blockUntil),
        cancellationBlockedAt: admin.firestore.FieldValue.serverTimestamp(),
        cancellationBlockReason: 'trucker-cancellation-limit-reached',
        cancellationBlockCountAtTrigger: cancellationCount,
        cancellationBlockThreshold: TRUCKER_CANCELLATION_THRESHOLD,
        cancellationBlockWindowDays: TRUCKER_CANCELLATION_WINDOW_DAYS,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

      await db.collection(`users/${truckerId}/notifications`).doc().set({
        type: 'ACCOUNT_RESTRICTED',
        title: 'Contract Signing Temporarily Blocked',
        message: `You reached ${cancellationCount} trucker cancellations in ${TRUCKER_CANCELLATION_WINDOW_DAYS} days. You can sign new contracts again on ${blockUntil.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}.`,
        data: {
          reason: 'trucker-cancellation-limit-reached',
          blockUntil: blockUntil.toISOString(),
          count: cancellationCount,
          threshold: TRUCKER_CANCELLATION_THRESHOLD,
          windowDays: TRUCKER_CANCELLATION_WINDOW_DAYS,
        },
        isRead: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      const adminIds = await getAdminUserIds(db);
      await Promise.all(adminIds.map((adminId) => db.collection(`users/${adminId}/notifications`).doc().set({
        type: 'TRUCKER_CANCELLATION_THRESHOLD_HIT',
        title: 'Trucker Cancellation Threshold Hit',
        message: `Trucker ${truckerId} hit ${cancellationCount} cancellations in ${TRUCKER_CANCELLATION_WINDOW_DAYS} days.`,
        data: {
          truckerId,
          reason: 'trucker-cancellation-limit-reached',
          blockUntil: blockUntil.toISOString(),
          count: cancellationCount,
          threshold: TRUCKER_CANCELLATION_THRESHOLD,
        },
        isRead: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      })));

      await db.collection('adminLogs').add({
        action: 'TRUCKER_CANCELLATION_THRESHOLD_BLOCKED',
        targetUserId: truckerId,
        performedBy: 'system',
        performedAt: admin.firestore.FieldValue.serverTimestamp(),
        count: cancellationCount,
        threshold: TRUCKER_CANCELLATION_THRESHOLD,
        windowDays: TRUCKER_CANCELLATION_WINDOW_DAYS,
        blockDays: TRUCKER_CANCELLATION_BLOCK_DAYS,
        blockUntil: blockUntil.toISOString(),
      });

      throw new functions.https.HttpsError(
        'failed-precondition',
        'Trucker cancellation threshold reached. Contract signing is temporarily blocked.',
        {
          reason: 'trucker-cancellation-limit-reached',
          blockUntil: blockUntil.toISOString(),
          count: cancellationCount,
          threshold: TRUCKER_CANCELLATION_THRESHOLD,
          windowDays: TRUCKER_CANCELLATION_WINDOW_DAYS,
        }
      );
    }

    const resolvedPlateNumber = typeof truckPlateNumber === 'string' ? truckPlateNumber.trim() : '';
    if (!contract.vehiclePlateNumber && !resolvedPlateNumber) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Truck plate number is required before signing.',
        { reason: 'missing-truck-plate-number' }
      );
    }
    if (!contract.vehiclePlateNumber && resolvedPlateNumber) {
      updates.vehiclePlateNumber = resolvedPlateNumber;
    }
  }

  const signatureTimestamp = new Date();

  // Get user's name
  const userDoc = await db.collection('users').doc(userId).get();
  const userName = userDoc.exists ? (userDoc.data().name || userId) : userId;
  const signature = `${userName} - ${signatureTimestamp.toISOString()}`;

  if (isShipper) {
    updates.shipperSignature = signature;
    updates.shipperSignedAt = signatureTimestamp;
  } else {
    updates.truckerSignature = signature;
    updates.truckerSignedAt = signatureTimestamp;
  }

  await db.collection('contracts').doc(contractId).update(updates);

  // Re-read updated contract
  const updatedDoc = await db.collection('contracts').doc(contractId).get();
  const updatedContract = { id: updatedDoc.id, ...updatedDoc.data() };

  // Check if both parties have signed
  if (updatedContract.shipperSignature && updatedContract.truckerSignature) {
    const trackingNumber = generateTrackingNumber();

    await db.collection('contracts').doc(contractId).update({
      status: 'signed',
      signedAt: new Date(),
    });
    updatedContract.status = 'signed';

    // Create shipment
    const shipmentRef = db.collection('shipments').doc();
    await shipmentRef.set({
      contractId,
      trackingNumber,
      currentLocation: contract.pickupAddress,
      status: 'pending_pickup',
      progress: 0,
      participantIds: contract.participantIds,
      shipperId,
      truckerId,
      origin: contract.pickupAddress,
      destination: contract.deliveryAddress,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Platform fee due window starts at delivery confirmation, not at signing.
    if (contract.platformFee > 0 && !contract.platformFeePaid) {
      await db.collection('contracts').doc(contractId).update({
        platformFeeStatus: 'outstanding',
        platformFeeDueDate: null,
        platformFeeBillingStartedAt: null,
        platformFeeReminders: [],
        overdueAt: null,
      });
    }

    // Update listing status
    const listingCollection = isCargo ? 'cargoListings' : 'truckListings';
    if (contract.listingId) {
      await db.collection(listingCollection).doc(contract.listingId).update({
        status: 'in_transit',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    // Notify other party
    const otherUserId = isShipper ? bidderId : listingOwnerId;
    await db.collection(`users/${otherUserId}/notifications`).doc().set({
      type: 'SHIPMENT_UPDATE',
      title: 'Contract Fully Signed!',
      message: `Contract #${contract.contractNumber} is now active. Tracking: ${trackingNumber}`,
      data: { contractId, shipmentId: shipmentRef.id, trackingNumber },
      isRead: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    try {
      await recordTruckBookingContractActivity(db, contractId, { ...updatedContract, status: 'signed' }, 'signed');
    } catch (activityError) {
      console.error('Failed to record truck booking contract signed activity:', activityError);
    }
  } else {
    // Notify other party to sign
    const otherUserId = isShipper ? bidderId : listingOwnerId;
    await db.collection(`users/${otherUserId}/notifications`).doc().set({
      type: 'CONTRACT_READY',
      title: 'Waiting for Your Signature',
      message: `Contract #${contract.contractNumber} needs your signature`,
      data: { contractId },
      isRead: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  return {
    message: 'Contract signed successfully',
    contract: updatedContract,
    fullyExecuted: !!(updatedContract.shipperSignature && updatedContract.truckerSignature),
  };
});

/**
 * Complete Contract (Mark Delivered)
 */
exports.completeContract = functions.region('asia-southeast1').https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  const { contractId } = data;
  const userId = context.auth.uid;

  if (!contractId) {
    throw new functions.https.HttpsError('invalid-argument', 'Contract ID is required');
  }

  const db = admin.firestore();
  const platformSettings = await loadPlatformSettings(db);
  if (shouldBlockForMaintenance(platformSettings, context.auth?.token)) {
    throw new functions.https.HttpsError('failed-precondition', 'Platform is currently under maintenance');
  }

  const contractDoc = await db.collection('contracts').doc(contractId).get();
  if (!contractDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Contract not found');
  }

  const contract = { id: contractDoc.id, ...contractDoc.data() };

  if (contract.status !== 'signed') {
    throw new functions.https.HttpsError('failed-precondition', 'Contract must be signed before it can be completed');
  }

  const isCargo = contract.listingType === 'cargo';
  const shipperId = isCargo ? contract.listingOwnerId : contract.bidderId;
  const truckerId = isCargo ? contract.bidderId : contract.listingOwnerId;

  // Only shipper can confirm delivery completion
  if (shipperId !== userId) {
    throw new functions.https.HttpsError('permission-denied', 'Only the assigned shipper can confirm delivery');
  }

  const shipmentSnap = await db.collection('shipments')
    .where('contractId', '==', contractId)
    .limit(1)
    .get();

  if (shipmentSnap.empty) {
    throw new functions.https.HttpsError('failed-precondition', 'Shipment record is missing for this contract');
  }

  const shipmentDoc = shipmentSnap.docs[0];
  const shipmentData = shipmentDoc.data();
  if (shipmentData.status === 'pending_pickup' || shipmentData.status === 'pending') {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Shipment must be picked up before delivery can be confirmed'
    );
  }

  // Update contract status and start fee due window from confirmed delivery date.
  let deliveryDueDate = null;
  const completionTime = new Date();
  const completionUpdates = {
    status: 'completed',
    completedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (contract.platformFee > 0 && !contract.platformFeePaid) {
    deliveryDueDate = new Date(completionTime);
    deliveryDueDate.setDate(deliveryDueDate.getDate() + 3);
    completionUpdates.platformFeeStatus = 'outstanding';
    completionUpdates.platformFeeDueDate = admin.firestore.Timestamp.fromDate(deliveryDueDate);
    completionUpdates.platformFeeBillingStartedAt = admin.firestore.Timestamp.fromDate(completionTime);
    completionUpdates.platformFeeReminders = ['due_initial'];
    completionUpdates.overdueAt = null;
  }

  await db.collection('contracts').doc(contractId).update(completionUpdates);

  if (deliveryDueDate && !contract.platformFeePaid) {
    const feePayerId = contract.platformFeePayerId || truckerId;
    if (feePayerId) {
      await db.collection(`users/${feePayerId}/notifications`).doc(`platform_fee_${contractId}_due_initial`).set({
        type: 'PLATFORM_FEE_DUE',
        title: 'Platform Fee Payment Due',
        message: `Contract #${contract.contractNumber} has an unpaid platform fee of PHP ${Number(contract.platformFee || 0).toLocaleString('en-PH')}. Please pay on or before ${deliveryDueDate.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })} to avoid job restrictions when debt reaches PHP 15,000.`,
        data: {
          contractId,
          platformFee: contract.platformFee,
          dueDate: deliveryDueDate.toISOString(),
          actionRequired: 'PAY_PLATFORM_FEE',
          reminderStage: 'due_initial',
        },
        isRead: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    }
  }

  // Update shipment
  await shipmentDoc.ref.update({
    status: 'delivered',
    progress: 100,
    currentLocation: contract.deliveryAddress,
    shipperId: shipmentData.shipperId || shipperId,
    truckerId: shipmentData.truckerId || truckerId,
    updatedBy: userId,
    updatedByRole: 'shipper',
    deliveredAt: new Date(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Update listing status
  const listingCollection = contract.listingType === 'cargo' ? 'cargoListings' : 'truckListings';
  const listingStatus = contract.listingType === 'cargo' ? 'delivered' : 'completed';
  if (contract.listingId) {
    await db.collection(listingCollection).doc(contract.listingId).update({
      status: listingStatus,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  // Maintain trucker completion stats for profile surfaces (dropdown/profile cards).
  await db.collection('users').doc(truckerId).collection('truckerProfile').doc('profile').set({
    totalTrips: admin.firestore.FieldValue.increment(1),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  // Maintain shipper completion stats used by profile transaction cards.
  await db.collection('users').doc(shipperId).collection('shipperProfile').doc('profile').set({
    totalTransactions: admin.firestore.FieldValue.increment(1),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  // Notify both parties to rate
  for (const notifyUserId of [contract.bidderId, contract.listingOwnerId]) {
    await db.collection(`users/${notifyUserId}/notifications`).doc().set({
      type: 'RATING_REQUEST',
      title: 'Rate Your Experience',
      message: `Please rate your experience for contract #${contract.contractNumber}`,
      data: { contractId },
      isRead: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  // Note: Platform fee reminders are handled by the scheduled reminder system
  // No need to send additional notifications here

  try {
    await recordTruckBookingContractActivity(db, contractId, { ...contract, status: 'completed' }, 'completed');
  } catch (activityError) {
    console.error('Failed to record truck booking contract completed activity:', activityError);
  }

  return {
    message: 'Contract completed successfully',
    contract: { ...contract, status: 'completed' },
  };
});

/**
 * Cancel Contract (before pickup/completion)
 * Both parties or admin can cancel if no service rendered
 */
exports.cancelContract = functions.region('asia-southeast1').https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  const { contractId, reason, reasonCode } = data || {};
  const userId = context.auth.uid;

  if (!contractId) {
    throw new functions.https.HttpsError('invalid-argument', 'Contract ID is required');
  }

  const db = admin.firestore();
  const platformSettings = await loadPlatformSettings(db);
  if (shouldBlockForMaintenance(platformSettings, context.auth?.token)) {
    throw new functions.https.HttpsError('failed-precondition', 'Platform is currently under maintenance');
  }
  const contractDoc = await db.collection('contracts').doc(contractId).get();

  if (!contractDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Contract not found');
  }

  const contract = { id: contractDoc.id, ...contractDoc.data() };
  const isCargo = contract.listingType === 'cargo';
  const shipperId = contract.shipperId || (isCargo ? contract.listingOwnerId : contract.bidderId);
  const truckerId = contract.truckerId || (isCargo ? contract.bidderId : contract.listingOwnerId);

  // Verify user is participant or admin
  const userDoc = await db.collection('users').doc(userId).get();
  const isAdmin = userDoc.data()?.role === 'admin' || userDoc.data()?.isAdmin === true;
  const isParticipant = contract.participantIds?.includes(userId);

  if (!isAdmin && !isParticipant) {
    throw new functions.https.HttpsError('permission-denied', 'Not authorized');
  }

  const cancelledByRole = isAdmin
    ? 'admin'
    : (userId === truckerId ? 'trucker' : (userId === shipperId ? 'shipper' : 'unknown'));
  if (cancelledByRole === 'unknown') {
    throw new functions.https.HttpsError('permission-denied', 'Not authorized');
  }

  const normalizedReasonCode = normalizeReasonCode(reasonCode);
  const mappedTruckerReasonLabel = resolveTruckerCancellationReasonLabel(normalizedReasonCode);
  if (cancelledByRole === 'trucker' && !mappedTruckerReasonLabel) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Valid trucker cancellation reason code is required'
    );
  }
  const fallbackReason = typeof reason === 'string' ? reason.trim() : '';
  const resolvedReason = cancelledByRole === 'trucker'
    ? mappedTruckerReasonLabel
    : (fallbackReason || 'No reason provided');

  // Can only cancel if not yet completed/delivered
  if (contract.status === 'completed') {
    throw new functions.https.HttpsError('failed-precondition', 'Cannot cancel completed contract');
  }
  if (contract.status === 'cancelled') {
    throw new functions.https.HttpsError('failed-precondition', 'Contract is already cancelled');
  }

  // Check if any shipment activity occurred
  const shipmentSnap = await db.collection('shipments')
    .where('contractId', '==', contractId)
    .limit(1)
    .get();

  let hasActivity = false;
  if (!shipmentSnap.empty) {
    const shipment = shipmentSnap.docs[0].data();
    // If shipment has location updates beyond initial creation, consider it active
    hasActivity = ['picked_up', 'in_transit', 'delivered'].includes(shipment.status) || shipment.progress > 0;
  }

  // Admin can always cancel, participants can only cancel if no activity
  if (!isAdmin && hasActivity) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Cannot cancel contract after shipment has started. Please contact admin for dispute resolution.'
    );
  }

  // Cancel the contract
  const cancellationUpdates = {
    status: 'cancelled',
    cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
    cancelledBy: userId,
    cancelledByRole,
    shipperId,
    truckerId,
    cancellationReasonCode: cancelledByRole === 'trucker' ? normalizedReasonCode : null,
    cancellationReason: resolvedReason,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  // If platform fee was unpaid, clear billing dates (waive fee for cancelled contracts)
  if (!contract.platformFeePaid) {
    cancellationUpdates.platformFeeStatus = 'waived';
    cancellationUpdates.platformFeeDueDate = null;
    cancellationUpdates.platformFeeBillingStartedAt = null;
    cancellationUpdates.platformFeeReminders = [];
    cancellationUpdates.overdueAt = null;
  }

  await db.collection('contracts').doc(contractId).update(cancellationUpdates);

  // Recalculate fee payer debt from source-of-truth contracts to avoid stale suspension states.
  let payerReconciliation = null;
  if (contract.platformFeePayerId) {
    payerReconciliation = await reconcilePlatformFeePayerAccount(db, contract.platformFeePayerId);

    if (payerReconciliation?.shouldUnsuspend) {
      await db.collection(`users/${contract.platformFeePayerId}/notifications`).doc().set({
        type: 'ACCOUNT_UNSUSPENDED',
        title: 'Account Reactivated',
        message: 'Your account has been reactivated. No outstanding platform fees remain.',
        data: { contractId },
        isRead: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  }

  // Update listing status back to available
  if (contract.listingId) {
    const listingCollection = contract.listingType === 'cargo' ? 'cargoListings' : 'truckListings';
    await db.collection(listingCollection).doc(contract.listingId).update({
      status: 'available',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  // Notify all participants
  const notificationPromises = contract.participantIds.map(participantId => {
    return db.collection(`users/${participantId}/notifications`).doc().set({
      type: 'CONTRACT_CANCELLED',
      title: 'Contract Cancelled',
      message: `Contract #${contract.contractNumber} has been cancelled. ${contract.platformFeePaid ? '' : 'Platform fee waived.'}`,
      data: {
        contractId,
        reason: resolvedReason,
        reasonCode: cancelledByRole === 'trucker' ? normalizedReasonCode : null,
        cancelledByRole,
      },
      isRead: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  await Promise.all(notificationPromises);

  if (cancelledByRole === 'trucker') {
    const complianceRef = getTruckerComplianceRef(db, truckerId);
    const complianceDoc = await complianceRef.get();
    const complianceData = complianceDoc.exists ? (complianceDoc.data() || {}) : {};
    const now = new Date();
    const existingBlockUntil = toDateValue(complianceData.cancellationBlockUntil);
    const alreadyBlocked = existingBlockUntil && existingBlockUntil.getTime() > now.getTime();
    const rollingWindowStart = startOfRollingWindow(now, TRUCKER_CANCELLATION_WINDOW_DAYS);
    const resetAt = toDateValue(complianceData.cancellationResetAt);
    const baselineDate = resetAt && resetAt.getTime() > rollingWindowStart.getTime()
      ? resetAt
      : rollingWindowStart;
    const countSnap = await db.collection('contracts')
      .where('truckerId', '==', truckerId)
      .where('cancelledByRole', '==', 'trucker')
      .where('cancelledAt', '>=', admin.firestore.Timestamp.fromDate(baselineDate))
      .count()
      .get();
    const cancellationCount = Number(countSnap?.data()?.count || 0);

    if (cancellationCount >= TRUCKER_CANCELLATION_THRESHOLD && !alreadyBlocked) {
      const blockUntil = new Date(now);
      blockUntil.setDate(blockUntil.getDate() + TRUCKER_CANCELLATION_BLOCK_DAYS);

      await complianceRef.set({
        cancellationBlockUntil: admin.firestore.Timestamp.fromDate(blockUntil),
        cancellationBlockedAt: admin.firestore.FieldValue.serverTimestamp(),
        cancellationBlockReason: 'trucker-cancellation-limit-reached',
        cancellationBlockCountAtTrigger: cancellationCount,
        cancellationBlockThreshold: TRUCKER_CANCELLATION_THRESHOLD,
        cancellationBlockWindowDays: TRUCKER_CANCELLATION_WINDOW_DAYS,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

      await db.collection(`users/${truckerId}/notifications`).doc().set({
        type: 'ACCOUNT_RESTRICTED',
        title: 'Contract Signing Temporarily Blocked',
        message: `You reached ${cancellationCount} trucker cancellations in ${TRUCKER_CANCELLATION_WINDOW_DAYS} days. You can sign new contracts again on ${blockUntil.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}.`,
        data: {
          reason: 'trucker-cancellation-limit-reached',
          blockUntil: blockUntil.toISOString(),
          count: cancellationCount,
          threshold: TRUCKER_CANCELLATION_THRESHOLD,
          windowDays: TRUCKER_CANCELLATION_WINDOW_DAYS,
        },
        isRead: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      const adminIds = await getAdminUserIds(db);
      await Promise.all(adminIds.map((adminId) => db.collection(`users/${adminId}/notifications`).doc().set({
        type: 'TRUCKER_CANCELLATION_THRESHOLD_HIT',
        title: 'Trucker Cancellation Threshold Hit',
        message: `Trucker ${truckerId} hit ${cancellationCount} cancellations in ${TRUCKER_CANCELLATION_WINDOW_DAYS} days.`,
        data: {
          truckerId,
          reason: 'trucker-cancellation-limit-reached',
          blockUntil: blockUntil.toISOString(),
          count: cancellationCount,
          threshold: TRUCKER_CANCELLATION_THRESHOLD,
        },
        isRead: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      })));

      await db.collection('adminLogs').add({
        action: 'TRUCKER_CANCELLATION_THRESHOLD_BLOCKED',
        targetUserId: truckerId,
        relatedContractId: contractId,
        performedBy: 'system',
        performedAt: admin.firestore.FieldValue.serverTimestamp(),
        count: cancellationCount,
        threshold: TRUCKER_CANCELLATION_THRESHOLD,
        windowDays: TRUCKER_CANCELLATION_WINDOW_DAYS,
        blockDays: TRUCKER_CANCELLATION_BLOCK_DAYS,
        blockUntil: blockUntil.toISOString(),
      });
    }
  }

  try {
    await recordTruckBookingContractActivity(db, contractId, { ...contract, status: 'cancelled' }, 'cancelled');
  } catch (activityError) {
    console.error('Failed to record truck booking contract cancelled activity:', activityError);
  }

  return {
    message: 'Contract cancelled successfully',
    platformFeeWaived: !contract.platformFeePaid,
    outstandingAfterCancellation: payerReconciliation?.recalculatedOutstanding ?? null,
    accountReactivated: payerReconciliation?.shouldUnsuspend === true,
  };
});

/**
 * Get User's Contracts
 */
exports.getContracts = functions.region('asia-southeast1').https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  const { status } = data || {};
  const userId = context.auth.uid;
  const db = admin.firestore();

  let query = db.collection('contracts')
    .where('participantIds', 'array-contains', userId)
    .orderBy('createdAt', 'desc');

  const contractsSnap = await query.get();
  let contracts = contractsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  // Filter by status if requested
  if (status) {
    contracts = contracts.filter(c => c.status === status);
  }

  return { contracts, total: contracts.length };
});

/**
 * Get Single Contract
 */
exports.getContract = functions.region('asia-southeast1').https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  const { contractId } = data;
  const userId = context.auth.uid;

  if (!contractId) {
    throw new functions.https.HttpsError('invalid-argument', 'Contract ID is required');
  }

  const db = admin.firestore();

  const contractDoc = await db.collection('contracts').doc(contractId).get();
  if (!contractDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Contract not found');
  }

  const contract = { id: contractDoc.id, ...contractDoc.data() };

  // Check user is involved
  if (!contract.participantIds || !contract.participantIds.includes(userId)) {
    throw new functions.https.HttpsError('permission-denied', 'Not authorized to view this contract');
  }

  // Fetch associated shipment
  const shipmentSnap = await db.collection('shipments')
    .where('contractId', '==', contractId)
    .limit(1)
    .get();

  if (!shipmentSnap.empty) {
    contract.shipment = { id: shipmentSnap.docs[0].id, ...shipmentSnap.docs[0].data() };
  }

  return { contract };
});

/**
 * Get Contract by Bid ID
 */
exports.getContractByBid = functions.region('asia-southeast1').https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  const { bidId } = data;
  const userId = context.auth.uid;

  if (!bidId) {
    throw new functions.https.HttpsError('invalid-argument', 'Bid ID is required');
  }

  const db = admin.firestore();
  const contractSnap = await db.collection('contracts')
    .where('bidId', '==', bidId)
    .limit(1)
    .get();

  if (contractSnap.empty) {
    // No contract yet is an expected state for many bids; return a nullable payload
    // so callers can poll safely without surfacing HTTP 404 noise.
    return { contract: null };
  }

  const contractDoc = contractSnap.docs[0];
  const contract = { id: contractDoc.id, ...contractDoc.data() };

  // Enforce participant-level access for bid-based contract lookups
  if (!contract.participantIds || !contract.participantIds.includes(userId)) {
    throw new functions.https.HttpsError('permission-denied', 'Not authorized to view this contract');
  }

  // Fetch associated shipment
  const shipmentSnap = await db.collection('shipments')
    .where('contractId', '==', contractDoc.id)
    .limit(1)
    .get();

  if (!shipmentSnap.empty) {
    contract.shipment = { id: shipmentSnap.docs[0].id, ...shipmentSnap.docs[0].data() };
  }

  return { contract };
});

