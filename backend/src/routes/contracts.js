import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import admin from '../config/firebase-admin.js';

const router = Router();

// Helper: fetch bid and listing data from Firestore
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

const PLATFORM_FEE_RATE = parseFloat(process.env.PLATFORM_FEE_RATE) || 0.03;

// Generate unique contract number
const generateContractNumber = () => {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `KC-${year}${month}-${random}`;
};

// Generate unique tracking number
const generateTrackingNumber = () => {
  const random = Math.random().toString(36).substring(2, 10).toUpperCase();
  return `TRK-${random}`;
};

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

// Get all contracts for the current user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status } = req.query;
    const userId = req.user.uid;
    const db = admin.firestore();

    // Query contracts where user is a participant
    let q = db.collection('contracts')
      .where('participantIds', 'array-contains', userId)
      .orderBy('createdAt', 'desc');

    const contractsSnap = await q.get();
    let contracts = contractsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Filter by status if requested
    if (status) {
      contracts = contracts.filter(c => c.status === status);
    }

    res.json({
      contracts,
      total: contracts.length,
    });
  } catch (error) {
    console.error('Get contracts error:', error);
    res.status(500).json({ error: 'Failed to get contracts' });
  }
});

// Get single contract
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.uid;
    const db = admin.firestore();

    const contractDoc = await db.collection('contracts').doc(req.params.id).get();
    if (!contractDoc.exists) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    const contract = { id: contractDoc.id, ...contractDoc.data() };

    // Check user is involved
    if (!contract.participantIds || !contract.participantIds.includes(userId)) {
      return res.status(403).json({ error: 'Not authorized to view this contract' });
    }

    // Fetch associated shipment
    const shipmentSnap = await db.collection('shipments')
      .where('contractId', '==', contractDoc.id)
      .limit(1)
      .get();

    if (!shipmentSnap.empty) {
      contract.shipment = { id: shipmentSnap.docs[0].id, ...shipmentSnap.docs[0].data() };
    }

    res.json({ contract });
  } catch (error) {
    console.error('Get contract error:', error);
    res.status(500).json({ error: 'Failed to get contract' });
  }
});

// Create contract from accepted bid
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      bidId,
      terms,
      declaredCargoValue,
      pickupDate,
      expectedDeliveryDate,
      specialInstructions,
      liabilityAcknowledged
    } = req.body;
    const userId = req.user.uid;

    if (!bidId) {
      return res.status(400).json({ error: 'Bid ID is required' });
    }

    const db = admin.firestore();

    // Fetch bid and listing from Firestore
    const bidData = await getFirestoreBidData(bidId);
    if (!bidData || !bidData.bid) {
      return res.status(404).json({ error: 'Bid not found' });
    }

    const { bid, listing, isCargo } = bidData;

    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    if (bid.status !== 'accepted') {
      return res.status(400).json({ error: 'Bid must be accepted before creating a contract' });
    }

    // Check if contract already exists for this bid in Firestore
    const existingContractSnap = await db.collection('contracts')
      .where('bidId', '==', bidId)
      .limit(1)
      .get();
    if (!existingContractSnap.empty) {
      return res.status(400).json({ error: 'Contract already exists for this bid' });
    }

    const listingOwnerId = listing.userId;

    // Only listing owner can create contract
    if (listingOwnerId !== userId) {
      return res.status(403).json({ error: 'Only the listing owner can create the contract' });
    }

    const platformFee = Math.round(bid.price * PLATFORM_FEE_RATE);

    // Check if platform fee has been paid in Firestore
    const feeSnap = await db.collection('platformFees')
      .where('bidId', '==', bidId)
      .where('status', '==', 'completed')
      .limit(1)
      .get();

    if (feeSnap.empty) {
      return res.status(400).json({
        error: 'Platform fee must be paid before creating contract',
        requiresPayment: true,
        platformFee: platformFee,
        bidId: bidId,
      });
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
- Maximum liability cap: Declared Value stated in this contract
- If no declared value is provided, default maximum liability is PHP 100,000
- Cap may not apply in cases of gross negligence, willful misconduct, fraud, theft, or illegal acts
- Trucker is not liable for force majeure, shipper's fault, or inherent defect of cargo
- Claims cover direct and documented loss, supported by delivery records and proof of value
- For higher-value cargo, full value declaration before pickup is recommended

3. PAYMENT TERMS
- Freight Rate: PHP ${Number(bid.price).toLocaleString()}
- Platform Service Fee: PHP ${platformFee.toLocaleString()} (${(PLATFORM_FEE_RATE * 100).toFixed(0)}%) - PAID BY TRUCKER VIA GCASH
- Freight Payment Method: Direct payment from Shipper to Trucker via GCash or another mutually agreed method
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

    // Determine participant IDs for Firestore security rules
    const participantIds = [listingOwnerId, bid.bidderId];

    // Create contract in Firestore
    const contractRef = db.collection('contracts').doc();
    const contractData = {
      bidId,
      contractNumber,
      agreedPrice: bid.price,
      platformFee,
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

    // Update listing status in Firestore
    const listingCollection = isCargo ? 'cargoListings' : 'truckListings';
    await db.collection(listingCollection).doc(listing.id).update({
      status: 'contracted',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Update bid status in Firestore
    await db.collection('bids').doc(bidId).update({
      status: 'contracted',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Create notification in Firestore for bidder
    await db.collection(`users/${bid.bidderId}/notifications`).doc().set({
      type: 'CONTRACT_READY',
      title: 'Contract Ready for Signing',
      message: `Contract #${contractNumber} is ready for your signature. Please review the terms and sign to proceed.`,
      data: { contractId: contractRef.id, bidId },
      isRead: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${bid.bidderId}`).emit('contract-ready', {
        contractId: contractRef.id,
        contractNumber,
      });
    }

    res.status(201).json({
      message: 'Contract created successfully',
      contract: { id: contractRef.id, ...contractData },
    });
  } catch (error) {
    console.error('Create contract error:', error);
    res.status(500).json({ error: 'Failed to create contract' });
  }
});

// Sign contract
router.put('/:id/sign', authenticateToken, async (req, res) => {
  try {
    const contractId = req.params.id;
    const userId = req.user.uid;
    const db = admin.firestore();

    // Fetch contract from Firestore
    const contractDoc = await db.collection('contracts').doc(contractId).get();
    if (!contractDoc.exists) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    const contract = { id: contractDoc.id, ...contractDoc.data() };

    if (contract.status !== 'draft') {
      return res.status(400).json({ error: 'Contract has already been signed or is not in draft status' });
    }

    const listingOwnerId = contract.listingOwnerId;
    const bidderId = contract.bidderId;
    const isCargo = contract.listingType === 'cargo';

    // Determine if user is shipper or trucker in this transaction
    let isShipper, isTrucker;
    if (isCargo) {
      isShipper = listingOwnerId === userId;
      isTrucker = bidderId === userId;
    } else {
      isTrucker = listingOwnerId === userId;
      isShipper = bidderId === userId;
    }

    if (!isShipper && !isTrucker) {
      return res.status(403).json({ error: 'Not authorized to sign this contract' });
    }

    const signatureTimestamp = new Date();
    const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip || 'unknown';

    // Get user's name from Firestore
    const userDoc = await db.collection('users').doc(userId).get();
    const userName = userDoc.exists ? (userDoc.data().name || userId) : userId;
    const signature = `${userName} - ${signatureTimestamp.toISOString()}`;

    const updates = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };

    if (isShipper) {
      if (contract.shipperSignature) {
        return res.status(400).json({ error: 'Shipper has already signed' });
      }
      updates.shipperSignature = signature;
      updates.shipperSignedAt = signatureTimestamp;
      updates.shipperSignatureIp = clientIp;
    } else {
      if (contract.truckerSignature) {
        return res.status(400).json({ error: 'Trucker has already signed' });
      }
      updates.truckerSignature = signature;
      updates.truckerSignedAt = signatureTimestamp;
      updates.truckerSignatureIp = clientIp;
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

      // Create shipment in Firestore
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

      // Update listing status to in_transit
      const listingCollection = isCargo ? 'cargoListings' : 'truckListings';
      if (contract.listingId) {
        await db.collection(listingCollection).doc(contract.listingId).update({
          status: 'in_transit',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      // Notify both parties
      const otherUserId = isShipper ? bidderId : listingOwnerId;
      await db.collection(`users/${otherUserId}/notifications`).doc().set({
        type: 'SHIPMENT_UPDATE',
        title: 'Contract Fully Signed!',
        message: `Contract #${contract.contractNumber} is now active. Tracking: ${trackingNumber}`,
        data: { contractId, shipmentId: shipmentRef.id, trackingNumber },
        isRead: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Emit socket events
      const io = req.app.get('io');
      if (io) {
        io.to(`user:${otherUserId}`).emit('contract-signed', {
          contractId,
          trackingNumber,
        });
      }
    } else {
      // Notify the other party to sign
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

    res.json({
      message: 'Contract signed successfully',
      contract: updatedContract,
      fullyExecuted: !!(updatedContract.shipperSignature && updatedContract.truckerSignature),
    });
  } catch (error) {
    console.error('Sign contract error:', error);
    res.status(500).json({ error: 'Failed to sign contract' });
  }
});

// Complete contract (mark delivery done)
router.put('/:id/complete', authenticateToken, async (req, res) => {
  try {
    const contractId = req.params.id;
    const userId = req.user.uid;
    const db = admin.firestore();

    const contractDoc = await db.collection('contracts').doc(contractId).get();
    if (!contractDoc.exists) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    const contract = { id: contractDoc.id, ...contractDoc.data() };

    if (contract.status !== 'signed') {
      return res.status(400).json({ error: 'Contract must be signed before it can be completed' });
    }

    // Only listing owner can mark complete
    if (contract.listingOwnerId !== userId) {
      return res.status(403).json({ error: 'Only the listing owner can mark the contract as complete' });
    }

    // Update contract status
    await db.collection('contracts').doc(contractId).update({
      status: 'completed',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Update shipment in Firestore
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

    const io = req.app.get('io');
    if (io) {
      io.to(`user:${contract.bidderId}`).emit('contract-completed', { contractId });
    }

    res.json({
      message: 'Contract completed successfully',
      contract: { ...contract, status: 'completed' },
    });
  } catch (error) {
    console.error('Complete contract error:', error);
    res.status(500).json({ error: 'Failed to complete contract' });
  }
});

// Get contract by bid ID
router.get('/bid/:bidId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.uid;
    const db = admin.firestore();
    const contractSnap = await db.collection('contracts')
      .where('bidId', '==', req.params.bidId)
      .limit(1)
      .get();

    if (contractSnap.empty) {
      return res.status(404).json({ error: 'Contract not found for this bid' });
    }

    const contractDoc = contractSnap.docs[0];
    const contract = { id: contractDoc.id, ...contractDoc.data() };

    // Enforce participant-level access for bid-based contract lookups
    if (!contract.participantIds || !contract.participantIds.includes(userId)) {
      return res.status(403).json({ error: 'Not authorized to view this contract' });
    }

    // Fetch associated shipment
    const shipmentSnap = await db.collection('shipments')
      .where('contractId', '==', contractDoc.id)
      .limit(1)
      .get();

    if (!shipmentSnap.empty) {
      contract.shipment = { id: shipmentSnap.docs[0].id, ...shipmentSnap.docs[0].data() };
    }

    res.json({ contract });
  } catch (error) {
    console.error('Get contract by bid error:', error);
    res.status(500).json({ error: 'Failed to get contract' });
  }
});

export default router;
