import {
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  increment,
  writeBatch
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, auth } from '../firebase';
import { getCoordinates } from '../utils/cityCoordinates';
import { PLATFORM_FEE_RATE } from '../utils/constants';

// ============================================================
// PHOTO UPLOAD
// ============================================================

export const uploadListingPhotos = async (userId, photos, listingType = 'cargo') => {
  if (!photos || photos.length === 0) return [];

  const uploadPromises = photos.map(async (photo, index) => {
    // Handle both new File objects and existing URL strings
    if (typeof photo === 'string') {
      // Already a URL, return as-is
      return photo;
    }

    // Get the actual File object
    const file = photo.file || photo;
    if (!(file instanceof File)) {
      console.warn('Invalid photo object, skipping:', photo);
      return null;
    }

    const timestamp = Date.now();
    const fileName = `${listingType}_${userId}_${timestamp}_${index}_${file.name}`;
    const storageRef = ref(storage, `listings/${listingType}/${userId}/${fileName}`);

    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);
    return downloadURL;
  });

  const results = await Promise.all(uploadPromises);
  return results.filter(url => url !== null);
};

// ============================================================
// USER OPERATIONS
// ============================================================

export const getUserProfile = async (uid) => {
  const userRef = doc(db, 'users', uid);
  const snap = await getDoc(userRef);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

export const updateUserProfile = async (uid, data) => {
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, {
    ...data,
    updatedAt: serverTimestamp()
  });
};

// ============================================================
// CARGO LISTINGS
// ============================================================

export const createCargoListing = async (userId, userProfile, data) => {
  const originCoords = getCoordinates(data.origin);
  const destCoords = getCoordinates(data.destination);

  const listingData = {
    userId,
    userName: userProfile.name,
    userTransactions: userProfile.shipperProfile?.totalTransactions || 0,
    origin: data.origin,
    destination: data.destination,
    originLat: originCoords.lat,
    originLng: originCoords.lng,
    destLat: destCoords.lat,
    destLng: destCoords.lng,
    cargoType: data.cargoType,
    weight: parseFloat(data.weight) || 0,
    weightUnit: data.weightUnit || 'tons',
    vehicleNeeded: data.vehicleNeeded,
    askingPrice: parseFloat(data.askingPrice) || 0,
    description: data.description || '',
    pickupDate: data.pickupDate,
    photos: data.photos || [],
    status: 'open',
    bidCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  const docRef = await addDoc(collection(db, 'cargoListings'), listingData);
  return { id: docRef.id, ...listingData };
};

export const updateCargoListing = async (listingId, data) => {
  const listingRef = doc(db, 'cargoListings', listingId);
  await updateDoc(listingRef, {
    ...data,
    updatedAt: serverTimestamp()
  });
};

export const deleteCargoListing = async (listingId) => {
  const listingRef = doc(db, 'cargoListings', listingId);
  await deleteDoc(listingRef);
};

// ============================================================
// TRUCK LISTINGS
// ============================================================

export const createTruckListing = async (userId, userProfile, truckerProfile, data) => {
  const originCoords = getCoordinates(data.origin);
  const destCoords = getCoordinates(data.destination);

  const listingData = {
    userId,
    userName: userProfile.name,
    userRating: truckerProfile?.rating || 0,
    userTrips: truckerProfile?.totalTrips || 0,
    origin: data.origin,
    destination: data.destination,
    originLat: originCoords.lat,
    originLng: originCoords.lng,
    destLat: destCoords.lat,
    destLng: destCoords.lng,
    vehicleType: data.vehicleType,
    capacity: parseFloat(data.capacity) || 0,
    capacityUnit: data.capacityUnit || 'tons',
    plateNumber: data.plateNumber || '',
    askingPrice: parseFloat(data.askingPrice) || 0,
    description: data.description || '',
    availableDate: data.availableDate,
    departureTime: data.departureTime || '',
    photos: data.photos || [],
    status: 'open',
    bidCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  const docRef = await addDoc(collection(db, 'truckListings'), listingData);
  return { id: docRef.id, ...listingData };
};

export const updateTruckListing = async (listingId, data) => {
  const listingRef = doc(db, 'truckListings', listingId);
  await updateDoc(listingRef, {
    ...data,
    updatedAt: serverTimestamp()
  });
};

export const deleteTruckListing = async (listingId) => {
  const listingRef = doc(db, 'truckListings', listingId);
  await deleteDoc(listingRef);
};

// ============================================================
// BIDS
// ============================================================

export const createBid = async (bidderId, bidderProfile, listing, listingType, data) => {
  const bidData = {
    bidderId,
    bidderName: bidderProfile.name,
    bidderType: listingType === 'cargo' ? 'trucker' : 'shipper',
    bidderRating: bidderProfile.truckerProfile?.rating || null,
    bidderTrips: bidderProfile.truckerProfile?.totalTrips || null,
    bidderTransactions: bidderProfile.shipperProfile?.totalTransactions || null,
    cargoListingId: listingType === 'cargo' ? listing.id : null,
    truckListingId: listingType === 'truck' ? listing.id : null,
    listingType,
    listingOwnerId: listing.userId,
    listingOwnerName: listing.shipper || listing.trucker || listing.userName || 'Unknown',
    origin: listing.origin,
    destination: listing.destination,
    price: parseFloat(data.price) || 0,
    message: data.message || '',
    cargoType: data.cargoType || null,
    cargoWeight: data.cargoWeight ? parseFloat(data.cargoWeight) : null,
    status: 'pending',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  const batch = writeBatch(db);

  // Create bid
  const bidRef = doc(collection(db, 'bids'));
  batch.set(bidRef, bidData);

  // Update listing bid count
  const listingRef = listingType === 'cargo'
    ? doc(db, 'cargoListings', listing.id)
    : doc(db, 'truckListings', listing.id);
  batch.update(listingRef, { bidCount: increment(1), updatedAt: serverTimestamp() });

  // Create notification for listing owner
  const notifRef = doc(collection(db, 'users', listing.userId, 'notifications'));
  batch.set(notifRef, {
    type: 'NEW_BID',
    title: 'New Bid Received!',
    message: `${bidderProfile.name} bid ₱${data.price.toLocaleString()} on your ${listing.origin} → ${listing.destination} ${listingType}`,
    data: {
      bidId: bidRef.id,
      listingId: listing.id,
      listingType,
      bidderId,
      bidderName: bidderProfile.name,
      price: data.price,
      route: `${listing.origin} → ${listing.destination}`
    },
    isRead: false,
    createdAt: serverTimestamp()
  });

  await batch.commit();
  return { id: bidRef.id, ...bidData };
};

export const acceptBid = async (bidId, bid, listing, listingType) => {
  const batch = writeBatch(db);

  // Update accepted bid
  const bidRef = doc(db, 'bids', bidId);
  batch.update(bidRef, { status: 'accepted', updatedAt: serverTimestamp() });

  // Update listing status
  const listingRef = listingType === 'cargo'
    ? doc(db, 'cargoListings', listing.id)
    : doc(db, 'truckListings', listing.id);
  batch.update(listingRef, { status: 'negotiating', updatedAt: serverTimestamp() });

  // Reject all other pending bids on this listing
  const otherBidsQuery = listingType === 'cargo'
    ? query(collection(db, 'bids'), where('cargoListingId', '==', listing.id), where('status', '==', 'pending'))
    : query(collection(db, 'bids'), where('truckListingId', '==', listing.id), where('status', '==', 'pending'));

  const otherBidsSnap = await getDocs(otherBidsQuery);
  otherBidsSnap.forEach((docSnap) => {
    if (docSnap.id !== bidId) {
      batch.update(docSnap.ref, { status: 'rejected', updatedAt: serverTimestamp() });
    }
  });

  // Create notification for bidder
  const notifRef = doc(collection(db, 'users', bid.bidderId, 'notifications'));
  batch.set(notifRef, {
    type: 'BID_ACCEPTED',
    title: 'Your Bid Was Accepted!',
    message: `Your ₱${bid.price.toLocaleString()} bid for ${listing.origin} → ${listing.destination} was accepted`,
    data: {
      bidId,
      listingId: listing.id,
      listingType,
      price: bid.price,
      route: `${listing.origin} → ${listing.destination}`
    },
    isRead: false,
    createdAt: serverTimestamp()
  });

  await batch.commit();
};

export const rejectBid = async (bidId, bid, listing, listingType) => {
  const batch = writeBatch(db);

  // Update bid status
  const bidRef = doc(db, 'bids', bidId);
  batch.update(bidRef, { status: 'rejected', updatedAt: serverTimestamp() });

  // Create notification for bidder
  const notifRef = doc(collection(db, 'users', bid.bidderId, 'notifications'));
  batch.set(notifRef, {
    type: 'BID_REJECTED',
    title: 'Bid Declined',
    message: `Your ₱${bid.price.toLocaleString()} bid for ${listing.origin} → ${listing.destination} was declined`,
    data: {
      bidId,
      listingId: listing.id,
      listingType,
      price: bid.price,
      route: `${listing.origin} → ${listing.destination}`
    },
    isRead: false,
    createdAt: serverTimestamp()
  });

  await batch.commit();
};

export const withdrawBid = async (bidId) => {
  const bidRef = doc(db, 'bids', bidId);
  await updateDoc(bidRef, { status: 'withdrawn', updatedAt: serverTimestamp() });
};

// ============================================================
// CHAT MESSAGES
// ============================================================

export const sendChatMessage = async (bidId, senderId, senderName, message, recipientId) => {
  const batch = writeBatch(db);

  // Create message
  const messageRef = doc(collection(db, 'bids', bidId, 'messages'));
  batch.set(messageRef, {
    senderId,
    senderName,
    message,
    isRead: false,
    createdAt: serverTimestamp()
  });

  // Create notification for recipient
  const notifRef = doc(collection(db, 'users', recipientId, 'notifications'));
  batch.set(notifRef, {
    type: 'NEW_MESSAGE',
    title: 'New Message',
    message: `${senderName}: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`,
    data: {
      bidId,
      senderId,
      senderName
    },
    isRead: false,
    createdAt: serverTimestamp()
  });

  await batch.commit();
  return { id: messageRef.id };
};

export const markMessagesRead = async (bidId, userId) => {
  const messagesQuery = query(
    collection(db, 'bids', bidId, 'messages'),
    where('senderId', '!=', userId),
    where('isRead', '==', false)
  );
  const snap = await getDocs(messagesQuery);

  const batch = writeBatch(db);
  snap.forEach((docSnap) => {
    batch.update(docSnap.ref, { isRead: true });
  });
  await batch.commit();
};

// ============================================================
// CONTRACTS
// ============================================================

export const createContract = async (bid, listing, listingType, shipperProfile, truckerProfile) => {
  const shipperId = listingType === 'cargo' ? listing.userId : bid.bidderId;
  const truckerId = listingType === 'cargo' ? bid.bidderId : listing.userId;
  const agreedPrice = bid.price;
  const platformFee = Math.round(agreedPrice * PLATFORM_FEE_RATE);
  const contractNumber = `KC-${Date.now().toString(36).toUpperCase()}`;

  const contractData = {
    bidId: bid.id,
    cargoListingId: listingType === 'cargo' ? listing.id : null,
    truckListingId: listingType === 'truck' ? listing.id : null,
    listingType,
    shipperId,
    shipperName: listingType === 'cargo' ? listing.userName : bid.bidderName,
    truckerId,
    truckerName: listingType === 'cargo' ? bid.bidderName : listing.userName,
    participantIds: [shipperId, truckerId],
    contractNumber,
    agreedPrice,
    platformFee,
    shipperSignature: null,
    truckerSignature: null,
    signedAt: null,
    terms: `Cargo delivery from ${listing.origin} to ${listing.destination}. Agreed price: ₱${agreedPrice.toLocaleString()}. Platform fee: ₱${platformFee.toLocaleString()} (${PLATFORM_FEE_RATE * 100}%)`,
    status: 'draft',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  const docRef = await addDoc(collection(db, 'contracts'), contractData);
  return { id: docRef.id, ...contractData };
};

export const signContract = async (contractId, party, signature) => {
  const contractRef = doc(db, 'contracts', contractId);
  const signatureField = party === 'shipper' ? 'shipperSignature' : 'truckerSignature';

  await updateDoc(contractRef, {
    [signatureField]: signature,
    updatedAt: serverTimestamp()
  });

  // Check if both parties have signed
  const contractSnap = await getDoc(contractRef);
  const contract = contractSnap.data();

  if (contract.shipperSignature && contract.truckerSignature) {
    await updateDoc(contractRef, {
      status: 'signed',
      signedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }
};

// ============================================================
// WALLET OPERATIONS
// ============================================================

export const topUpWallet = async (uid, amount, method, reference) => {
  const batch = writeBatch(db);

  // Update wallet balance
  const walletRef = doc(db, 'users', uid, 'wallet', 'main');
  batch.update(walletRef, {
    balance: increment(amount),
    updatedAt: serverTimestamp()
  });

  // Create transaction record
  const txRef = doc(collection(db, 'users', uid, 'walletTransactions'));
  batch.set(txRef, {
    type: 'topup',
    amount,
    method,
    description: `Top up via ${method}`,
    reference,
    status: 'completed',
    createdAt: serverTimestamp()
  });

  await batch.commit();
  return { transactionId: txRef.id };
};

export const deductPlatformFee = async (uid, amount, description, contractId) => {
  const batch = writeBatch(db);

  // Deduct from wallet
  const walletRef = doc(db, 'users', uid, 'wallet', 'main');
  batch.update(walletRef, {
    balance: increment(-amount),
    updatedAt: serverTimestamp()
  });

  // Create transaction record
  const txRef = doc(collection(db, 'users', uid, 'walletTransactions'));
  batch.set(txRef, {
    type: 'fee',
    amount: -amount,
    method: null,
    description,
    reference: contractId,
    status: 'completed',
    createdAt: serverTimestamp()
  });

  await batch.commit();
};

// ============================================================
// NOTIFICATIONS
// ============================================================

export const createNotification = async (userId, data) => {
  const notifRef = doc(collection(db, 'users', userId, 'notifications'));
  await setDoc(notifRef, {
    ...data,
    isRead: false,
    createdAt: serverTimestamp()
  });
  return { id: notifRef.id };
};

export const markNotificationRead = async (userId, notificationId) => {
  const notifRef = doc(db, 'users', userId, 'notifications', notificationId);
  await updateDoc(notifRef, { isRead: true });
};

export const markAllNotificationsRead = async (userId) => {
  const notificationsQuery = query(
    collection(db, 'users', userId, 'notifications'),
    where('isRead', '==', false)
  );
  const snap = await getDocs(notificationsQuery);

  const batch = writeBatch(db);
  snap.forEach((docSnap) => {
    batch.update(docSnap.ref, { isRead: true });
  });
  await batch.commit();
};

export const deleteNotification = async (userId, notificationId) => {
  const notifRef = doc(db, 'users', userId, 'notifications', notificationId);
  await deleteDoc(notifRef);
};

// ============================================================
// SHIPMENTS
// ============================================================

export const createShipment = async (contract, listing) => {
  const trackingNumber = `TRK-${Date.now().toString(36).toUpperCase()}`;

  const shipmentData = {
    contractId: contract.id,
    cargoListingId: contract.cargoListingId,
    truckListingId: contract.truckListingId,
    shipperId: contract.shipperId,
    shipperName: contract.shipperName,
    truckerId: contract.truckerId,
    truckerName: contract.truckerName,
    participantIds: contract.participantIds,
    trackingNumber,
    origin: listing.origin,
    destination: listing.destination,
    currentLat: listing.originLat,
    currentLng: listing.originLng,
    currentLocation: listing.origin,
    status: 'picked_up',
    progress: 0,
    eta: null,
    deliveredAt: null,
    cargoDescription: listing.cargoType || listing.vehicleType,
    vehiclePlate: listing.plateNumber || '',
    needsRating: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  const docRef = await addDoc(collection(db, 'shipments'), shipmentData);
  return { id: docRef.id, ...shipmentData };
};

export const updateShipmentLocation = async (shipmentId, lat, lng, locationName, progress, status) => {
  const shipmentRef = doc(db, 'shipments', shipmentId);
  const updateData = {
    currentLat: lat,
    currentLng: lng,
    currentLocation: locationName,
    progress,
    status,
    updatedAt: serverTimestamp()
  };

  if (status === 'delivered') {
    updateData.deliveredAt = serverTimestamp();
    updateData.needsRating = true;
  }

  await updateDoc(shipmentRef, updateData);
};

// ============================================================
// RATINGS
// ============================================================

export const createRating = async (contractId, raterId, ratedUserId, score, tags, comment) => {
  const ratingData = {
    contractId,
    raterId,
    ratedUserId,
    score,
    tags: tags || [],
    comment: comment || null,
    createdAt: serverTimestamp()
  };

  const docRef = await addDoc(collection(db, 'ratings'), ratingData);

  // Update rated user's average rating (for truckers)
  const ratingsQuery = query(
    collection(db, 'ratings'),
    where('ratedUserId', '==', ratedUserId)
  );
  const ratingsSnap = await getDocs(ratingsQuery);

  let totalScore = score;
  let count = 1;
  ratingsSnap.forEach((docSnap) => {
    if (docSnap.id !== docRef.id) {
      totalScore += docSnap.data().score;
      count++;
    }
  });

  const avgRating = parseFloat((totalScore / count).toFixed(1));

  // Update trucker profile rating
  const truckerRef = doc(db, 'users', ratedUserId, 'truckerProfile', 'profile');
  const truckerSnap = await getDoc(truckerRef);
  if (truckerSnap.exists()) {
    await updateDoc(truckerRef, {
      rating: avgRating,
      updatedAt: serverTimestamp()
    });
  }

  return { id: docRef.id, ...ratingData, avgRating };
};

// ============================================================
// BROKER OPERATIONS
// ============================================================

export const createBrokerProfile = async (uid, referralCode) => {
  const brokerRef = doc(db, 'users', uid, 'brokerProfile', 'profile');
  await setDoc(brokerRef, {
    referralCode,
    tier: 'STARTER',
    totalEarnings: 0,
    pendingEarnings: 0,
    availableBalance: 0,
    totalReferrals: 0,
    totalTransactions: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
};

export const generateReferralCode = (role) => {
  const prefix = role === 'shipper' ? 'SHP' : 'TRK';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const random = Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `${prefix}${random}`;
};

// ============================================================
// PAYMENT SCREENSHOT VERIFICATION
// ============================================================

/**
 * Upload payment screenshot to Firebase Storage
 * @param {string} orderId - Order ID for the payment
 * @param {File} file - Screenshot file to upload
 * @returns {Promise<string>} - Download URL of uploaded screenshot
 */
export const uploadPaymentScreenshot = async (orderId, file) => {
  const userId = auth.currentUser?.uid;
  if (!userId) throw new Error('Not authenticated');

  // Validate file
  if (!file) throw new Error('No file provided');
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Invalid file type. Please upload a JPG, PNG, or WebP image.');
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('File too large. Maximum size is 5MB.');
  }

  // Generate unique filename
  const timestamp = Date.now();
  const extension = file.name.split('.').pop() || 'jpg';
  const fileName = `${orderId}_${timestamp}.${extension}`;
  const storageRef = ref(storage, `payments/${userId}/${fileName}`);

  // Upload file
  const snapshot = await uploadBytes(storageRef, file);
  const downloadURL = await getDownloadURL(snapshot.ref);

  return downloadURL;
};

/**
 * Create a payment submission document in Firestore
 * This triggers the Cloud Function to process the screenshot
 * @param {Object} data - Submission data
 * @returns {Promise<Object>} - Created submission with ID
 */
export const createPaymentSubmission = async (data) => {
  const userId = auth.currentUser?.uid;
  if (!userId) throw new Error('Not authenticated');

  const submissionData = {
    orderId: data.orderId,
    userId,
    screenshotUrl: data.screenshotUrl,
    status: 'pending',
    ocrStatus: 'pending',
    uploadedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  const docRef = await addDoc(collection(db, 'paymentSubmissions'), submissionData);
  return { id: docRef.id, ...submissionData };
};

/**
 * Get payment submission by ID
 * @param {string} submissionId - Submission ID
 * @returns {Promise<Object|null>} - Submission data or null
 */
export const getPaymentSubmission = async (submissionId) => {
  const docRef = doc(db, 'paymentSubmissions', submissionId);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
};

/**
 * Get submissions for an order
 * @param {string} orderId - Order ID
 * @returns {Promise<Array>} - Array of submissions
 */
export const getSubmissionsForOrder = async (orderId) => {
  const q = query(
    collection(db, 'paymentSubmissions'),
    where('orderId', '==', orderId),
    orderBy('createdAt', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

/**
 * Get user's payment orders
 * @param {string} userId - User ID
 * @param {string} status - Optional status filter
 * @returns {Promise<Array>} - Array of orders
 */
export const getUserPaymentOrders = async (userId, status = null) => {
  let q = query(
    collection(db, 'orders'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(20)
  );

  if (status) {
    q = query(
      collection(db, 'orders'),
      where('userId', '==', userId),
      where('status', '==', status),
      orderBy('createdAt', 'desc'),
      limit(20)
    );
  }

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};
