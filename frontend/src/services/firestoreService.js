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
  writeBatch
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, auth, functions } from '../firebase';
import { getCoordinates } from '../utils/cityCoordinates';


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
    originStreetAddress: data.originStreetAddress || '',
    destinationStreetAddress: data.destinationStreetAddress || '',
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
    originStreetAddress: data.originStreetAddress || '',
    destinationStreetAddress: data.destinationStreetAddress || '',
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
  const listingOwnerId = listing.userId || listing.shipperId || listing.truckerId;
  if (!listingOwnerId) {
    throw new Error('Cannot place bid: listing owner is missing');
  }

  const bidData = {
    bidderId,
    bidderName: bidderProfile.name,
    bidderType: listingType === 'cargo' ? 'trucker' : 'shipper',
    bidderRating: bidderProfile.truckerProfile?.rating || null,
    bidderTrips: bidderProfile.truckerProfile?.totalTrips || null,
    bidderTransactions: bidderProfile.shipperProfile?.totalTransactions || null,
    listingId: listing.id,
    cargoListingId: listingType === 'cargo' ? listing.id : null,
    truckListingId: listingType === 'truck' ? listing.id : null,
    listingType,
    listingOwnerId,
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

  // Listing bid count is incremented server-side by onBidCreated trigger.
  // Notifications are generated by backend/socket listeners.

  await batch.commit();
  return { id: bidRef.id, ...bidData };
};

export const acceptBid = async (bidId, bid, listing, listingType) => {
  // Prefer server-authoritative acceptance so App Check/browser storage quirks
  // don't block legitimate listing-owner actions.
  try {
    const acceptBidCallable = httpsCallable(functions, 'acceptBid');
    await acceptBidCallable({ bidId });
    return;
  } catch (error) {
    const code = String(error?.code || '').toLowerCase();
    const message = String(error?.message || '').toLowerCase();
    const callableMissing =
      code.includes('unimplemented') ||
      code.includes('not-found') ||
      message.includes('function not found') ||
      message.includes('does not exist');
    if (!callableMissing) {
      throw error;
    }
    // Backward-compatible fallback for environments where the callable
    // has not been deployed yet.
  }

  const batch = writeBatch(db);
  const currentUserId = auth.currentUser?.uid || null;
  if (!currentUserId) {
    throw new Error('Must be signed in to accept a bid');
  }

  const authoritativeListingOwnerId =
    bid?.listingOwnerId || listing?.userId || listing?.shipperId || listing?.truckerId || null;

  if (authoritativeListingOwnerId && authoritativeListingOwnerId !== currentUserId) {
    throw new Error('Only the listing owner can accept this bid');
  }

  const listingOwnerId = authoritativeListingOwnerId || currentUserId;

  if (!listingOwnerId) {
    throw new Error('Cannot accept bid: listing owner is missing');
  }

  const listingRef = listingType === 'cargo'
    ? doc(db, 'cargoListings', listing.id)
    : doc(db, 'truckListings', listing.id);
  const listingSnap = await getDoc(listingRef);
  if (!listingSnap.exists()) {
    const error = new Error('Listing no longer exists');
    error.code = 'not-found';
    throw error;
  }

  const listingData = listingSnap.data() || {};
  if (listingData.userId !== currentUserId) {
    const error = new Error('Only the listing owner can accept this bid');
    error.code = 'permission-denied';
    throw error;
  }

  // Mirror security rule checks client-side so users get actionable errors
  // instead of a generic Firestore permission failure.
  const feePayerId = bid?.cargoListingId ? bid?.bidderId : bid?.listingOwnerId;
  if (feePayerId) {
    const feePayerSnap = await getDoc(doc(db, 'users', feePayerId));
    if (feePayerSnap.exists()) {
      const feePayerData = feePayerSnap.data() || {};
      const isFeePayerActive =
        feePayerData.isActive !== false &&
        feePayerData.accountStatus !== 'suspended';
      if (!isFeePayerActive) {
        const error = new Error('The selected bid cannot be accepted because the payer account is restricted');
        error.code = 'payer-account-restricted';
        throw error;
      }

      const createdAtMillis = typeof feePayerData.createdAt?.toMillis === 'function'
        ? feePayerData.createdAt.toMillis()
        : Date.now();
      const isNewAccount = Date.now() < createdAtMillis + (30 * 24 * 60 * 60 * 1000);
      const isVerified = feePayerData.isVerified === true;
      const outstandingCap = !isVerified ? 7000 : (isNewAccount ? 10000 : 20000);
      const outstanding = Number(feePayerData.outstandingPlatformFees || 0);
      const bidPrice = Number(bid?.price || 0);
      const projectedOutstanding = outstanding + (bidPrice * 0.05);

      if (projectedOutstanding > outstandingCap) {
        const error = new Error('Projected outstanding platform fees exceed allowed cap');
        error.code = 'platform-fee-cap-exceeded';
        throw error;
      }
    }
  }

  // Update accepted bid
  const bidRef = doc(db, 'bids', bidId);
  batch.update(bidRef, { status: 'accepted', updatedAt: serverTimestamp() });

  // Update listing status
  batch.update(listingRef, { status: 'negotiating', updatedAt: serverTimestamp() });

  // Reject all other pending bids on this listing
  const otherBidsQuery = query(
    collection(db, 'bids'),
    where('listingOwnerId', '==', listingOwnerId)
  );

  const otherBidsSnap = await getDocs(otherBidsQuery);
  otherBidsSnap.forEach((docSnap) => {
    const bidDoc = docSnap.data();
    const isSameListing = listingType === 'cargo'
      ? bidDoc.cargoListingId === listing.id
      : bidDoc.truckListingId === listing.id;

    if (docSnap.id !== bidId && isSameListing && bidDoc.status === 'pending') {
      batch.update(docSnap.ref, { status: 'rejected', updatedAt: serverTimestamp() });
    }
  });

  // Notification is sent by the onBidStatusChanged server trigger — no client-side notification needed.

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

export const reopenListing = async (listingId, listingType) => {
  const batch = writeBatch(db);
  const currentUserId = auth.currentUser?.uid;

  if (!currentUserId) {
    throw new Error('Must be signed in to reopen listing');
  }

  // Update listing status back to open
  const listingRef = listingType === 'cargo'
    ? doc(db, 'cargoListings', listingId)
    : doc(db, 'truckListings', listingId);

  batch.update(listingRef, {
    status: 'open',
    updatedAt: serverTimestamp()
  });

  // Reject all accepted bids (if any) for this listing
  const bidsQuery = query(
    collection(db, 'bids'),
    where('listingOwnerId', '==', currentUserId)
  );

  const bidsSnapshot = await getDocs(bidsQuery);
  bidsSnapshot.forEach((bidDoc) => {
    const bidData = bidDoc.data();
    const isSameListing = bidData.listingId === listingId && bidData.listingType === listingType;
    if (isSameListing && bidData.status === 'accepted') {
      const bidRef = doc(db, 'bids', bidDoc.id);
      batch.update(bidRef, {
        status: 'rejected',
        updatedAt: serverTimestamp()
      });
    }
  });

  await batch.commit();
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
    recipientId: recipientId || null,
    message,
    read: false,
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
  const messagesQuery = query(collection(db, 'bids', bidId, 'messages'));
  const snap = await getDocs(messagesQuery);

  const batch = writeBatch(db);
  snap.forEach((docSnap) => {
    const message = docSnap.data();
    if (message.senderId !== userId && !(message.isRead === true || message.read === true)) {
      batch.update(docSnap.ref, { isRead: true, read: true });
    }
  });
  await batch.commit();
};

// Contract creation, signing, wallet top-up, and platform fee deduction
// are all handled server-side via Cloud Functions (see api.js).

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
  await updateDoc(notifRef, { isRead: true, read: true });
};

export const markAllNotificationsRead = async (userId) => {
  const notificationsQuery = query(
    collection(db, 'users', userId, 'notifications'),
    where('isRead', '==', false)
  );
  const snap = await getDocs(notificationsQuery);

  const batch = writeBatch(db);
  snap.forEach((docSnap) => {
    batch.update(docSnap.ref, { isRead: true, read: true });
  });
  await batch.commit();
};

export const deleteNotification = async (userId, notificationId) => {
  const notifRef = doc(db, 'users', userId, 'notifications', notificationId);
  await deleteDoc(notifRef);
};

// Shipment creation is handled server-side via Cloud Functions.

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
    bidId: data.bidId || null, // NEW: Link to bid for platform fee payments
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

// ============================================================
// RATING READ HELPERS (replaces Express /ratings/* endpoints)
// ============================================================

/**
 * Get ratings received by a user
 * @param {string} userId
 * @returns {Promise<{ratings: Array, averageScore: number, totalRatings: number}>}
 */
export const getRatingsForUser = async (userId) => {
  const snapshot = await getDocs(
    query(collection(db, 'ratings'), where('ratedUserId', '==', userId), orderBy('createdAt', 'desc'))
  );
  const ratings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  const averageScore = ratings.length
    ? ratings.reduce((sum, r) => sum + (r.score || 0), 0) / ratings.length
    : 0;
  return { ratings, averageScore: Math.round(averageScore * 10) / 10, totalRatings: ratings.length };
};

/**
 * Get ratings for a specific contract
 * @param {string} contractId
 * @returns {Promise<Array>}
 */
export const getRatingsForContract = async (contractId) => {
  const snapshot = await getDocs(
    query(collection(db, 'ratings'), where('contractId', '==', contractId))
  );
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

/**
 * Get ratings submitted by the current user
 * @param {string} userId
 * @returns {Promise<Array>}
 */
export const getMyRatings = async (userId) => {
  const snapshot = await getDocs(
    query(collection(db, 'ratings'), where('raterId', '==', userId), orderBy('createdAt', 'desc'))
  );
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};
