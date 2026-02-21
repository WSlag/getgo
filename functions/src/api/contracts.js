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
- Platform Service Fee: PHP ${platformFee.toLocaleString()} (${feePercent.toFixed(2).replace(/\.00$/, '')}%) - Payable by Trucker within 3 days of shipment pickup
- Payment Method: Direct payment from Shipper to Trucker
- Payment Schedule: As agreed between parties (COD, advance, or partial)
- Late Payment: Failure to pay platform fee within 3 days will result in account suspension until payment is received

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
    message: `Contract #${contractNumber} is ready for your review. Please sign to activate. Platform fee of ₱${platformFee.toLocaleString()} will be due 3 days after pickup.`,
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

  // Fetch contract
  const contractDoc = await db.collection('contracts').doc(contractId).get();
  if (!contractDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Contract not found');
  }

  const contract = { id: contractDoc.id, ...contractDoc.data() };

  if (contract.status === 'signed' || contract.status === 'completed') {
    throw new functions.https.HttpsError('failed-precondition', 'Contract has already been signed');
  }

  const listingOwnerId = contract.listingOwnerId;
  const bidderId = contract.bidderId;
  const isCargo = contract.listingType === 'cargo';

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

  const signatureTimestamp = new Date();

  // Get user's name
  const userDoc = await db.collection('users').doc(userId).get();
  const userName = userDoc.exists ? (userDoc.data().name || userId) : userId;
  const signature = `${userName} - ${signatureTimestamp.toISOString()}`;

  const updates = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };

  if (isShipper) {
    if (contract.shipperSignature) {
      throw new functions.https.HttpsError('already-exists', 'Shipper has already signed');
    }
    updates.shipperSignature = signature;
    updates.shipperSignedAt = signatureTimestamp;
  } else {
    if (contract.truckerSignature) {
      throw new functions.https.HttpsError('already-exists', 'Trucker has already signed');
    }
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
      status: 'picked_up',
      progress: 0,
      participantIds: contract.participantIds,
      origin: contract.pickupAddress,
      destination: contract.deliveryAddress,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Platform fee grace period starts at signing for all contracts
    if (contract.platformFee > 0) {
      const pickupTime = new Date();
      const dueDate = new Date(pickupTime);
      dueDate.setDate(dueDate.getDate() + 3);

      const billingUpdates = {
        platformFeeStatus: contract.platformFeePaid ? 'paid' : 'outstanding',
        platformFeeDueDate: admin.firestore.Timestamp.fromDate(dueDate),
        platformFeeBillingStartedAt: admin.firestore.Timestamp.fromDate(pickupTime),
        platformFeeReminders: [],
      };

      await db.collection('contracts').doc(contractId).update(billingUpdates);

      // Only notify if fee is NOT already paid
      if (!contract.platformFeePaid) {
        const feePayerId = contract.platformFeePayerId
          || (isCargo ? contract.bidderId : contract.listingOwnerId);

        if (feePayerId) {
          await db.collection(`users/${feePayerId}/notifications`).doc().set({
            type: 'PLATFORM_FEE_DUE',
            title: 'Platform Fee Payment Due',
            message: `Contract #${contract.contractNumber} is now active. Platform fee of ₱${contract.platformFee.toLocaleString()} is due by ${dueDate.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}.`,
            data: {
              contractId,
              platformFee: contract.platformFee,
              dueDate: dueDate.toISOString(),
              actionRequired: 'PAY_PLATFORM_FEE',
            },
            isRead: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
      }
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

  // Only listing owner can mark complete
  if (contract.listingOwnerId !== userId) {
    throw new functions.https.HttpsError('permission-denied', 'Only the listing owner can mark the contract as complete');
  }

  // Update contract status.
  // For deferred platform fees, start reminder/suspension window only after completion.
  const completionUpdates = {
    status: 'completed',
    completedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  // Platform fee billing dates are now set at contract signing, not completion
  // No need to set them again here

  await db.collection('contracts').doc(contractId).update(completionUpdates);

  // Update shipment
  const shipmentSnap = await db.collection('shipments')
    .where('contractId', '==', contractId)
    .limit(1)
    .get();

  if (!shipmentSnap.empty) {
    await shipmentSnap.docs[0].ref.update({
      status: 'delivered',
      progress: 100,
      currentLocation: contract.deliveryAddress,
      deliveredAt: new Date(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  // Update listing status
  const listingCollection = contract.listingType === 'cargo' ? 'cargoListings' : 'truckListings';
  const listingStatus = contract.listingType === 'cargo' ? 'delivered' : 'completed';
  if (contract.listingId) {
    await db.collection(listingCollection).doc(contract.listingId).update({
      status: listingStatus,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

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

  const { contractId, reason } = data;
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

  const contract = contractDoc.data();

  // Verify user is participant or admin
  const userDoc = await db.collection('users').doc(userId).get();
  const isAdmin = userDoc.data()?.role === 'admin';
  const isParticipant = contract.participantIds?.includes(userId);

  if (!isAdmin && !isParticipant) {
    throw new functions.https.HttpsError('permission-denied', 'Not authorized');
  }

  // Can only cancel if not yet completed/delivered
  if (contract.status === 'completed') {
    throw new functions.https.HttpsError('failed-precondition', 'Cannot cancel completed contract');
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
    hasActivity = shipment.status === 'in_transit' || shipment.progress > 0;
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
    cancellationReason: reason || 'No reason provided',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  // If platform fee was unpaid, clear billing dates (waive fee for cancelled contracts)
  if (!contract.platformFeePaid) {
    cancellationUpdates.platformFeeStatus = 'waived';
    cancellationUpdates.platformFeeDueDate = null;
    cancellationUpdates.platformFeeBillingStartedAt = null;

    // Deduct from user's outstanding fees if it was already counted
    const feePayerId = contract.platformFeePayerId;
    if (feePayerId) {
      const payerDoc = await db.collection('users').doc(feePayerId).get();
      const currentOutstanding = payerDoc.data()?.outstandingPlatformFees || 0;

      await db.collection('users').doc(feePayerId).update({
        outstandingPlatformFees: Math.max(0, currentOutstanding - (contract.platformFee || 0)),
        outstandingFeeContracts: admin.firestore.FieldValue.arrayRemove(contractId),
      });
    }
  }

  await db.collection('contracts').doc(contractId).update(cancellationUpdates);

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
      data: { contractId, reason },
      isRead: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  await Promise.all(notificationPromises);

  return {
    message: 'Contract cancelled successfully',
    platformFeeWaived: !contract.platformFeePaid,
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
    throw new functions.https.HttpsError('not-found', 'Contract not found for this bid');
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
