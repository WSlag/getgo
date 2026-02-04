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
import { db } from '../firebase';
import { getCoordinates } from '../utils/cityCoordinates';
import { PLATFORM_FEE_RATE } from '../utils/constants';

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
