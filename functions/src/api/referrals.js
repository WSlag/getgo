/**
 * Broker Referral & Commission Cloud Functions
 * Authoritative implementation for broker registration, attribution,
 * commission accrual (based on platform fee), and admin payout approvals.
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { FieldValue } = require('firebase-admin/firestore');
const {
  loadPlatformSettings,
  shouldBlockForMaintenance,
} = require('../config/platformSettings');
const {
  ACTIVITY_TYPES,
  LISTING_REFERRAL_COLLECTION,
  MARKET_ACTIVITY_COLLECTION,
  LISTING_REFERRAL_STATUSES,
  ACTIVE_LISTING_REFERRAL_STATUSES,
  TERMINAL_LISTING_REFERRAL_STATUSES,
  normalizeListingType,
  normalizeListingStatus,
  isListingReferable,
  buildListingReferralId,
  toMillis,
  encodeCursor,
  decodeCursor,
  maskDisplayName,
  normalizeTypeFilter,
  normalizeStatusFilter,
  normalizeReferredStatusFilter,
  matchesTypeFilter,
  matchesStatusFilter,
  matchesReferredStatusFilter,
  buildBrokerActivitySummary,
  upsertBrokerMarketplaceActivity,
  upsertBrokerListingReferral,
  logReferralAudit,
} = require('../services/brokerListingReferralService');

const REGION = 'asia-southeast1';
const MIN_PAYOUT_AMOUNT = 500;
const MAX_REFERRAL_RECIPIENTS = 20;
const MAX_DAILY_LISTING_REFERRALS = 200;
const MAX_ACTIVITY_LIMIT = 50;
const REFERRAL_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_REFERRAL_RATES = {
  STARTER: 3,
  SILVER: 4,
  GOLD: 5,
  PLATINUM: 6,
};
const ALLOWED_TIERS = Object.keys(DEFAULT_REFERRAL_RATES);

function normalizeReferralCode(input) {
  return String(input || '').trim().toUpperCase();
}

function buildBrokerCodePrefix(role) {
  if (role === 'shipper') return 'SHP';
  if (role === 'trucker') return 'TRK';
  return 'BRK';
}

function roundToCents(value) {
  const n = Number(value || 0);
  return Math.round(n * 100) / 100;
}

function toDate(value) {
  if (!value) return null;
  if (value.toDate && typeof value.toDate === 'function') return value.toDate();
  if (typeof value.seconds === 'number') return new Date(value.seconds * 1000);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toTimestampNumber(value) {
  const dateValue = toDate(value);
  return dateValue ? dateValue.getTime() : 0;
}

function resolveCommissionRate(tier, settings) {
  const normalizedTier = String(tier || 'STARTER').toUpperCase();
  const rates = settings?.referralCommission || {};
  const configuredRate =
    rates[normalizedTier] ??
    rates[normalizedTier.toLowerCase()] ??
    rates[(normalizedTier.charAt(0) + normalizedTier.slice(1).toLowerCase())];
  const parsedRate = Number(configuredRate);
  if (Number.isFinite(parsedRate) && parsedRate > 0) {
    return parsedRate;
  }
  return DEFAULT_REFERRAL_RATES[normalizedTier] || DEFAULT_REFERRAL_RATES.STARTER;
}

async function assertReferralProgramEnabled(db, context) {
  const settings = await loadPlatformSettings(db);
  if (shouldBlockForMaintenance(settings, context?.auth?.token)) {
    throw new functions.https.HttpsError('failed-precondition', 'Platform is currently under maintenance');
  }
  if (settings?.features?.referralProgramEnabled === false) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Referral program is currently disabled by admin'
    );
  }
}

async function verifyAdmin(context) {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  if (context.auth.token?.admin === true) {
    return true;
  }

  const db = admin.firestore();
  const userDoc = await db.collection('users').doc(context.auth.uid).get();
  if (!userDoc.exists) {
    throw new functions.https.HttpsError('permission-denied', 'Admin access required');
  }

  const user = userDoc.data() || {};
  if (user.isAdmin === true || user.role === 'admin') {
    return true;
  }

  throw new functions.https.HttpsError('permission-denied', 'Admin access required');
}

async function assertActiveBroker(db, userId) {
  const brokerDoc = await db.collection('brokers').doc(userId).get();
  if (!brokerDoc.exists) {
    throw new functions.https.HttpsError('permission-denied', 'Broker profile not found');
  }
  const broker = brokerDoc.data() || {};
  if (broker.status && broker.status !== 'active') {
    throw new functions.https.HttpsError('failed-precondition', 'Broker account is not active');
  }
  return { id: brokerDoc.id, ...broker };
}

async function getMaskedUserMap(db, userIds = []) {
  const uniqueIds = [...new Set(userIds.map((id) => String(id || '').trim()).filter(Boolean))];
  if (uniqueIds.length === 0) return {};

  const userDocs = await db.getAll(...uniqueIds.map((uid) => db.collection('users').doc(uid)));
  const map = {};
  userDocs.forEach((doc) => {
    if (!doc.exists) return;
    const user = doc.data() || {};
    map[doc.id] = {
      id: doc.id,
      name: user.name || null,
      phone: user.phone || null,
      role: user.role || null,
      masked: maskDisplayName(user.name, user.phone),
    };
  });
  return map;
}

function mapContractPhaseToType(phase) {
  if (phase === 'created') return ACTIVITY_TYPES.TRUCK_BOOKING_CONTRACT_CREATED;
  if (phase === 'signed') return ACTIVITY_TYPES.TRUCK_BOOKING_CONTRACT_SIGNED;
  if (phase === 'completed') return ACTIVITY_TYPES.TRUCK_BOOKING_CONTRACT_COMPLETED;
  return ACTIVITY_TYPES.TRUCK_BOOKING_CONTRACT_CANCELLED;
}

async function generateUniqueReferralCode(db, role) {
  const prefix = buildBrokerCodePrefix(role);
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

  for (let attempt = 0; attempt < 25; attempt += 1) {
    const random = Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    const code = `${prefix}${random}`;
    const existing = await db.collection('brokers').where('referralCode', '==', code).limit(1).get();
    if (existing.empty) return code;
  }

  throw new functions.https.HttpsError('resource-exhausted', 'Failed to generate unique referral code');
}

async function notifyAllAdmins(db, payload) {
  const [adminsByRole, adminsByFlag] = await Promise.all([
    db.collection('users').where('role', '==', 'admin').limit(50).get(),
    db.collection('users').where('isAdmin', '==', true).limit(50).get(),
  ]);

  const adminIds = new Set();
  const batch = db.batch();

  [...adminsByRole.docs, ...adminsByFlag.docs].forEach((doc) => {
    if (adminIds.has(doc.id)) return;
    adminIds.add(doc.id);
    const notifRef = db.collection('users').doc(doc.id).collection('notifications').doc();
    batch.set(notifRef, {
      ...payload,
      isRead: false,
      createdAt: FieldValue.serverTimestamp(),
    });
  });

  if (adminIds.size > 0) {
    await batch.commit();
  }
}

/**
 * Register current user as broker (server-authoritative).
 */
exports.brokerRegister = functions.region(REGION).https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  const db = admin.firestore();
  await assertReferralProgramEnabled(db, context);
  const userId = context.auth.uid;
  const userRef = db.collection('users').doc(userId);
  const brokerRef = db.collection('brokers').doc(userId);
  const brokerProfileRef = userRef.collection('brokerProfile').doc('profile');

  const [userDoc, brokerDoc, brokerProfileDoc] = await Promise.all([
    userRef.get(),
    brokerRef.get(),
    brokerProfileRef.get(),
  ]);

  if (!userDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'User profile not found');
  }
  if (brokerDoc.exists || brokerProfileDoc.exists) {
    throw new functions.https.HttpsError('already-exists', 'Already registered as broker');
  }

  const user = userDoc.data() || {};
  const requestedCode = normalizeReferralCode(data?.referralCode);
  let referralCode = requestedCode;

  if (referralCode) {
    if (!/^[A-Z0-9]{6,12}$/.test(referralCode)) {
      throw new functions.https.HttpsError('invalid-argument', 'Referral code format is invalid');
    }
    const existingCode = await db.collection('brokers').where('referralCode', '==', referralCode).limit(1).get();
    if (!existingCode.empty) {
      throw new functions.https.HttpsError('already-exists', 'Referral code already in use');
    }
  } else {
    referralCode = await generateUniqueReferralCode(db, user.role);
  }

  const now = FieldValue.serverTimestamp();
  const profile = {
    userId,
    sourceRole: user.role || null,
    referralCode,
    tier: 'STARTER',
    status: 'active',
    totalEarnings: 0,
    pendingEarnings: 0,
    availableBalance: 0,
    totalReferrals: 0,
    totalTransactions: 0,
    createdAt: now,
    updatedAt: now,
  };

  await db.runTransaction(async (tx) => {
    tx.set(brokerRef, profile);
    tx.set(brokerProfileRef, profile);
    tx.update(userRef, {
      isBroker: true,
      brokerSourceRole: user.role || null,
      brokerRegisteredAt: now,
      updatedAt: now,
    });
  });

  return {
    success: true,
    broker: {
      userId,
      referralCode,
      tier: 'STARTER',
      status: 'active',
    },
  };
});

/**
 * Apply a referral code to the current authenticated user.
 * One-time attribution only.
 */
exports.brokerApplyReferralCode = functions.region(REGION).https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  const referralCode = normalizeReferralCode(data?.referralCode);
  if (!referralCode) {
    throw new functions.https.HttpsError('invalid-argument', 'Referral code is required');
  }

  const db = admin.firestore();
  await assertReferralProgramEnabled(db, context);
  const referredUserId = context.auth.uid;
  const referralRef = db.collection('brokerReferrals').doc(referredUserId);
  const referredUserRef = db.collection('users').doc(referredUserId);

  const brokerQuery = await db.collection('brokers').where('referralCode', '==', referralCode).limit(1).get();
  if (brokerQuery.empty) {
    throw new functions.https.HttpsError('not-found', 'Referral code not found');
  }

  const brokerDoc = brokerQuery.docs[0];
  const brokerId = brokerDoc.id;
  const broker = brokerDoc.data() || {};
  if (broker.status && broker.status !== 'active') {
    throw new functions.https.HttpsError('failed-precondition', 'Broker referral code is not active');
  }
  if (brokerId === referredUserId) {
    throw new functions.https.HttpsError('failed-precondition', 'Self-referral is not allowed');
  }

  const brokerRef = db.collection('brokers').doc(brokerId);
  const brokerProfileRef = db.collection('users').doc(brokerId).collection('brokerProfile').doc('profile');
  const now = FieldValue.serverTimestamp();

  await db.runTransaction(async (tx) => {
    const [existingReferral, referredUserDoc] = await Promise.all([
      tx.get(referralRef),
      tx.get(referredUserRef),
    ]);

    if (existingReferral.exists) {
      throw new functions.https.HttpsError('already-exists', 'Referral attribution already exists for this user');
    }
    if (!referredUserDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Referred user profile not found');
    }

    const referredUser = referredUserDoc.data() || {};
    if (referredUser.referredByBrokerId) {
      throw new functions.https.HttpsError('already-exists', 'Referral code already applied');
    }

    tx.set(referralRef, {
      brokerId,
      brokerCode: referralCode,
      referredUserId,
      referredRole: referredUser.role || null,
      status: 'attributed',
      totalQualifiedFees: 0,
      totalCommission: 0,
      totalTransactions: 0,
      createdAt: now,
      updatedAt: now,
    });

    tx.update(referredUserRef, {
      referredByBrokerId: brokerId,
      referredByCode: referralCode,
      referredAt: now,
      updatedAt: now,
    });

    tx.update(brokerRef, {
      totalReferrals: FieldValue.increment(1),
      updatedAt: now,
    });

    tx.set(brokerProfileRef, {
      totalReferrals: FieldValue.increment(1),
      updatedAt: now,
    }, { merge: true });
  });

  const referredUserDoc = await referredUserRef.get();
  const referredUser = referredUserDoc.exists ? referredUserDoc.data() || {} : {};
  const referredName = referredUser.name || referredUser.phone || 'A new user';

  await db.collection('users').doc(brokerId).collection('notifications').add({
    type: 'BROKER_NEW_REFERRAL',
    title: 'New Referral Attributed',
    message: `${referredName} joined using your referral code.`,
    data: {
      referredUserId,
      brokerId,
      referralCode,
    },
    isRead: false,
    createdAt: FieldValue.serverTimestamp(),
  });

  return { success: true, brokerId, referralCode };
});

/**
 * Get broker dashboard data (profile + ledger + payouts).
 */
exports.brokerGetDashboard = functions.region(REGION).https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  const userId = context.auth.uid;
  const db = admin.firestore();

  const brokerDoc = await db.collection('brokers').doc(userId).get();
  if (!brokerDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Broker profile not found');
  }

  const [referralsSnap, commissionsSnap, payoutsSnap] = await Promise.all([
    db.collection('brokerReferrals').where('brokerId', '==', userId).orderBy('createdAt', 'desc').limit(100).get(),
    db.collection('brokerCommissions').where('brokerId', '==', userId).orderBy('createdAt', 'desc').limit(100).get(),
    db.collection('brokerPayoutRequests').where('brokerId', '==', userId).orderBy('createdAt', 'desc').limit(100).get(),
  ]);

  const referrals = referralsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  const byCreatedDesc = (a, b) => {
    const aSeconds = a.createdAt?.seconds || 0;
    const bSeconds = b.createdAt?.seconds || 0;
    return bSeconds - aSeconds;
  };
  const commissions = commissionsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })).sort(byCreatedDesc).slice(0, 50);
  const payouts = payoutsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })).sort(byCreatedDesc).slice(0, 50);

  return {
    broker: { id: brokerDoc.id, ...brokerDoc.data() },
    referrals,
    commissions,
    payouts,
  };
});

/**
 * Broker: list attributed referred users for listing referral picker.
 */
exports.brokerGetReferredUsers = functions.region(REGION).https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  const db = admin.firestore();
  const brokerId = context.auth.uid;
  await assertReferralProgramEnabled(db, context);
  await assertActiveBroker(db, brokerId);

  const limit = Math.min(Math.max(Number(data?.limit || 20), 1), 50);
  const rawQuery = String(data?.query || '').trim().toLowerCase();
  const cursor = decodeCursor(data?.cursor);
  if (data?.cursor && !cursor) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid cursor');
  }

  let query = db.collection('brokerReferrals')
    .where('brokerId', '==', brokerId)
    .orderBy('createdAt', 'desc')
    .orderBy(admin.firestore.FieldPath.documentId(), 'desc');

  if (cursor) {
    query = query.startAfter(admin.firestore.Timestamp.fromMillis(cursor.ts), cursor.id);
  }

  const snap = await query.limit(limit + 1).get();
  const docs = snap.docs.slice(0, limit);
  const referredUserIds = docs.map((doc) => doc.id);
  const usersMap = await getMaskedUserMap(db, referredUserIds);

  let items = docs.map((doc) => {
    const referral = doc.data() || {};
    const user = usersMap[doc.id] || {};
    return {
      referredUserId: doc.id,
      referredRole: referral.referredRole || user.role || null,
      maskedDisplay: user.masked || 'User',
      createdAt: referral.createdAt || null,
      referralStatus: referral.status || 'attributed',
    };
  });

  if (rawQuery) {
    items = items.filter((item) => item.maskedDisplay.toLowerCase().includes(rawQuery));
  }

  const lastDoc = docs[docs.length - 1] || null;
  return {
    items,
    hasMore: snap.size > limit,
    nextCursor: lastDoc ? encodeCursor({ activityAt: lastDoc.data().createdAt, id: lastDoc.id }) : null,
  };
});

/**
 * Broker: refer a listing to attributed referred users.
 */
exports.brokerReferListing = functions.region(REGION).https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  const db = admin.firestore();
  const brokerId = context.auth.uid;
  await assertReferralProgramEnabled(db, context);
  await assertActiveBroker(db, brokerId);

  const listingId = String(data?.listingId || '').trim();
  const listingType = normalizeListingType(data?.listingType);
  const note = typeof data?.note === 'string' ? data.note.trim().slice(0, 200) : '';
  const requestedUsers = Array.isArray(data?.referredUserIds)
    ? [...new Set(data.referredUserIds.map((id) => String(id || '').trim()).filter(Boolean))]
    : [];

  if (!listingId || !listingType) {
    throw new functions.https.HttpsError('invalid-argument', 'listingId and valid listingType are required');
  }
  if (requestedUsers.length === 0) {
    throw new functions.https.HttpsError('invalid-argument', 'referredUserIds is required');
  }
  if (requestedUsers.length > MAX_REFERRAL_RECIPIENTS) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      `Maximum referredUserIds per request is ${MAX_REFERRAL_RECIPIENTS}`
    );
  }

  const brokerDoc = await db.collection('brokers').doc(brokerId).get();
  const broker = brokerDoc.data() || {};

  const listingCollection = listingType === 'cargo' ? 'cargoListings' : 'truckListings';
  const listingDoc = await db.collection(listingCollection).doc(listingId).get();
  if (!listingDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Listing not found');
  }
  const listing = listingDoc.data() || {};
  const listingOwnerId = listing.userId || listing.shipperId || listing.truckerId || null;
  if (!listingOwnerId) {
    throw new functions.https.HttpsError('failed-precondition', 'Listing owner is missing');
  }
  if (listingOwnerId === brokerId) {
    throw new functions.https.HttpsError('failed-precondition', 'Cannot refer your own listing');
  }
  if (!isListingReferable(listingType, listing.status)) {
    throw new functions.https.HttpsError('failed-precondition', 'Listing is not eligible for referral');
  }

  const referralDocs = await db.getAll(
    ...requestedUsers.map((uid) => db.collection('brokerReferrals').doc(uid))
  );
  const attributedUserIds = new Set();
  referralDocs.forEach((doc) => {
    if (!doc.exists) return;
    const referral = doc.data() || {};
    if (referral.brokerId === brokerId) {
      attributedUserIds.add(doc.id);
    }
  });

  const usersMap = await getMaskedUserMap(db, [...requestedUsers, brokerId, listingOwnerId]);
  const now = Date.now();
  const expiresAt = admin.firestore.Timestamp.fromMillis(now + REFERRAL_TTL_MS);
  const createdErrors = [];
  let createdCount = 0;
  let resentCount = 0;
  let skippedCount = 0;

  const brokerDailyUsage = Number(broker.dailyListingReferralCount || 0);
  if (brokerDailyUsage >= MAX_DAILY_LISTING_REFERRALS) {
    throw new functions.https.HttpsError('resource-exhausted', 'Daily referral limit reached');
  }

  for (const referredUserId of requestedUsers) {
    if (!attributedUserIds.has(referredUserId)) {
      skippedCount += 1;
      createdErrors.push({ referredUserId, code: 'not-attributed', message: 'User is not attributed to this broker' });
      continue;
    }

    const referralId = buildListingReferralId({
      brokerId,
      listingType,
      listingId,
      referredUserId,
    });
    const referralRef = db.collection(LISTING_REFERRAL_COLLECTION).doc(referralId);
    const existing = await referralRef.get();
    const existingData = existing.exists ? (existing.data() || {}) : null;

    if (existingData && existingData.status === LISTING_REFERRAL_STATUSES.ACTED) {
      skippedCount += 1;
      createdErrors.push({ referredUserId, code: 'already-acted', message: 'Referral already acted on this listing' });
      continue;
    }

    const basePayload = {
      brokerId,
      brokerMasked: usersMap[brokerId]?.masked || maskDisplayName(null, null),
      referredUserId,
      referredUserMasked: usersMap[referredUserId]?.masked || 'User',
      listingId,
      listingType,
      listingOwnerId,
      listingStatusAtSend: normalizeListingStatus(listing.status),
      route: {
        origin: listing.origin || null,
        destination: listing.destination || null,
      },
      askingPrice: Number(listing.askingPrice || listing.askingRate || 0) || null,
      note: note || null,
      status: LISTING_REFERRAL_STATUSES.PENDING,
      expiresAt,
      openedAt: null,
      actedAt: existingData?.actedAt || null,
      actedBidId: existingData?.actedBidId || null,
      resendCount: Number(existingData?.resendCount || 0) + (existingData ? 1 : 0),
      lastNotifiedAt: FieldValue.serverTimestamp(),
      source: 'broker_manual',
      updatedAt: FieldValue.serverTimestamp(),
    };

    const upsertResult = await upsertBrokerListingReferral(referralId, basePayload, db);
    if (upsertResult.created) {
      createdCount += 1;
      await logReferralAudit(db, 'create', brokerId, referralId, { listingId, listingType });
    } else {
      resentCount += 1;
      await logReferralAudit(db, 'resend', brokerId, referralId, { listingId, listingType });
    }

    await db.collection(`users/${referredUserId}/notifications`).doc().set({
      type: 'BROKER_LISTING_REFERRAL',
      title: 'New Listing Referral',
      message: `${usersMap[brokerId]?.masked || 'A broker'} referred a ${listingType} listing: ${listing.origin || 'origin'} -> ${listing.destination || 'destination'}.`,
      data: {
        referralId,
        listingId,
        listingType,
        brokerId,
      },
      isRead: false,
      createdAt: FieldValue.serverTimestamp(),
    });
  }

  const totalSent = createdCount + resentCount;
  if (totalSent > 0) {
    await db.collection('brokers').doc(brokerId).set({
      dailyListingReferralCount: FieldValue.increment(totalSent),
      lastListingReferralAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  }

  return {
    success: true,
    createdCount,
    resentCount,
    skippedCount,
    errors: createdErrors,
  };
});

/**
 * Broker: list listing referrals sent by broker.
 */
exports.brokerGetListingReferrals = functions.region(REGION).https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }
  const db = admin.firestore();
  const brokerId = context.auth.uid;
  await assertActiveBroker(db, brokerId);

  const limit = Math.min(Math.max(Number(data?.limit || 20), 1), 50);
  const statusFilterRaw = String(data?.statusFilter || 'all').trim().toLowerCase();
  const statusFilter = ['all', 'pending', 'opened', 'acted', 'dismissed', 'expired', 'closed_listing'].includes(statusFilterRaw)
    ? statusFilterRaw
    : null;
  if (!statusFilter) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid statusFilter');
  }
  const listingTypeFilterRaw = String(data?.listingTypeFilter || 'all').trim().toLowerCase();
  const listingTypeFilter = ['all', 'cargo', 'truck'].includes(listingTypeFilterRaw) ? listingTypeFilterRaw : null;
  if (!listingTypeFilter) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid listingTypeFilter');
  }

  const cursor = decodeCursor(data?.cursor);
  if (data?.cursor && !cursor) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid cursor');
  }

  let query = db.collection(LISTING_REFERRAL_COLLECTION)
    .where('brokerId', '==', brokerId)
    .orderBy('updatedAt', 'desc')
    .orderBy(admin.firestore.FieldPath.documentId(), 'desc');
  if (statusFilter !== 'all') {
    query = query.where('status', '==', statusFilter);
  }
  if (listingTypeFilter !== 'all') {
    query = query.where('listingType', '==', listingTypeFilter);
  }
  if (cursor) {
    query = query.startAfter(admin.firestore.Timestamp.fromMillis(cursor.ts), cursor.id);
  }

  const snap = await query.limit(limit + 1).get();
  const docs = snap.docs.slice(0, limit);
  const items = docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  const lastDoc = docs[docs.length - 1] || null;

  const summary = {
    total: items.length,
    sent24h: items.filter((item) => Date.now() - toMillis(item.updatedAt) <= 24 * 60 * 60 * 1000).length,
    sent7d: items.filter((item) => Date.now() - toMillis(item.updatedAt) <= 7 * 24 * 60 * 60 * 1000).length,
    opened: items.filter((item) => item.status === 'opened').length,
    acted: items.filter((item) => item.status === 'acted').length,
    expired: items.filter((item) => item.status === 'expired').length,
  };

  return {
    items,
    hasMore: snap.size > limit,
    nextCursor: lastDoc ? encodeCursor({ activityAt: lastDoc.data().updatedAt, id: lastDoc.id }) : null,
    summary,
  };
});

/**
 * Referred user: list listing referrals.
 */
exports.referredGetListingReferrals = functions.region(REGION).https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  const db = admin.firestore();
  const referredUserId = context.auth.uid;
  const limit = Math.min(Math.max(Number(data?.limit || 20), 1), 50);
  const statusFilter = normalizeReferredStatusFilter(data?.statusFilter || 'active');
  if (!statusFilter) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid statusFilter');
  }
  const cursor = decodeCursor(data?.cursor);
  if (data?.cursor && !cursor) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid cursor');
  }

  let query = db.collection(LISTING_REFERRAL_COLLECTION)
    .where('referredUserId', '==', referredUserId)
    .orderBy('updatedAt', 'desc')
    .orderBy(admin.firestore.FieldPath.documentId(), 'desc');

  if (cursor) {
    query = query.startAfter(admin.firestore.Timestamp.fromMillis(cursor.ts), cursor.id);
  }

  const scanLimit = Math.min(limit * 3, 150);
  const snap = await query.limit(scanLimit).get();
  const filtered = snap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter((item) => matchesReferredStatusFilter(item, statusFilter));
  const items = filtered.slice(0, limit);
  const lastItem = items[items.length - 1] || null;

  return {
    items,
    hasMore: filtered.length > limit || snap.size === scanLimit,
    nextCursor: lastItem ? encodeCursor({ activityAt: lastItem.updatedAt, id: lastItem.id }) : null,
  };
});

/**
 * Referred user: update listing referral state.
 */
exports.referredUpdateListingReferralState = functions.region(REGION).https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  const referralId = String(data?.referralId || '').trim();
  const action = String(data?.action || '').trim().toLowerCase();
  if (!referralId || !['opened', 'dismissed'].includes(action)) {
    throw new functions.https.HttpsError('invalid-argument', 'referralId and valid action are required');
  }

  const db = admin.firestore();
  const referredUserId = context.auth.uid;
  const referralRef = db.collection(LISTING_REFERRAL_COLLECTION).doc(referralId);
  const referralDoc = await referralRef.get();
  if (!referralDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Referral not found');
  }

  const referral = referralDoc.data() || {};
  if (referral.referredUserId !== referredUserId) {
    throw new functions.https.HttpsError('permission-denied', 'Not allowed to update this referral');
  }
  if (TERMINAL_LISTING_REFERRAL_STATUSES.includes(referral.status)) {
    return { success: true, status: referral.status };
  }

  const update = { updatedAt: FieldValue.serverTimestamp() };
  if (action === 'opened' && referral.status === LISTING_REFERRAL_STATUSES.PENDING) {
    update.status = LISTING_REFERRAL_STATUSES.OPENED;
    update.openedAt = FieldValue.serverTimestamp();
    await logReferralAudit(db, 'open', referredUserId, referralId, {});
  } else if (
    action === 'dismissed'
    && ACTIVE_LISTING_REFERRAL_STATUSES.includes(referral.status)
  ) {
    update.status = LISTING_REFERRAL_STATUSES.DISMISSED;
    await logReferralAudit(db, 'dismiss', referredUserId, referralId, {});
  } else {
    return { success: true, status: referral.status };
  }

  await referralRef.set(update, { merge: true });
  return { success: true, status: update.status || referral.status };
});

/**
 * Broker: read referred marketplace activity feed.
 */
exports.brokerGetMarketplaceActivity = functions.region(REGION).https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  const db = admin.firestore();
  const brokerId = context.auth.uid;
  await assertActiveBroker(db, brokerId);

  const limit = Math.min(Math.max(Number(data?.limit || 20), 1), MAX_ACTIVITY_LIMIT);
  const typeFilter = normalizeTypeFilter(data?.typeFilter || 'all');
  const statusFilter = normalizeStatusFilter(data?.statusFilter || 'all');
  if (!typeFilter || !statusFilter) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid typeFilter or statusFilter');
  }

  const cursor = decodeCursor(data?.cursor);
  if (data?.cursor && !cursor) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid cursor');
  }

  const dateFrom = data?.dateFrom ? new Date(data.dateFrom) : null;
  const dateTo = data?.dateTo ? new Date(data.dateTo) : null;
  if (dateFrom && Number.isNaN(dateFrom.getTime())) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid dateFrom');
  }
  if (dateTo && Number.isNaN(dateTo.getTime())) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid dateTo');
  }

  let query = db.collection(MARKET_ACTIVITY_COLLECTION)
    .where('brokerId', '==', brokerId)
    .orderBy('activityAt', 'desc')
    .orderBy(admin.firestore.FieldPath.documentId(), 'desc');

  if (dateFrom) {
    query = query.where('activityAt', '>=', admin.firestore.Timestamp.fromDate(dateFrom));
  }
  if (dateTo) {
    query = query.where('activityAt', '<=', admin.firestore.Timestamp.fromDate(dateTo));
  }
  if (cursor) {
    query = query.startAfter(admin.firestore.Timestamp.fromMillis(cursor.ts), cursor.id);
  }

  const scanLimit = Math.min(limit * 4, 200);
  const snap = await query.limit(scanLimit).get();
  const filtered = snap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter((item) => matchesTypeFilter(item, typeFilter) && matchesStatusFilter(item, statusFilter));

  const items = filtered.slice(0, limit);
  const lastItem = items[items.length - 1] || null;
  const summary = buildBrokerActivitySummary(filtered);

  await db.collection('brokerAccessLogs').add({
    brokerId,
    action: 'brokerGetMarketplaceActivity',
    typeFilter,
    statusFilter,
    itemCount: items.length,
    createdAt: FieldValue.serverTimestamp(),
  });

  return {
    items,
    hasMore: filtered.length > limit || snap.size === scanLimit,
    nextCursor: lastItem ? encodeCursor({ activityAt: lastItem.activityAt, id: lastItem.id }) : null,
    summary,
  };
});

/**
 * Broker: backfill referred marketplace activity history.
 */
exports.brokerBackfillMarketplaceActivity = functions.region(REGION).https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  const db = admin.firestore();
  const brokerId = context.auth.uid;
  await assertActiveBroker(db, brokerId);

  const brokerRef = db.collection('brokers').doc(brokerId);
  const brokerDoc = await brokerRef.get();
  const broker = brokerDoc.data() || {};
  const nowMillis = Date.now();
  const lastRunMillis = toMillis(broker.lastBrokerActivityBackfillAt);
  if (lastRunMillis && nowMillis - lastRunMillis < 60 * 1000) {
    throw new functions.https.HttpsError('failed-precondition', 'Backfill can only run once per minute');
  }

  const referralSnap = await db.collection('brokerReferrals')
    .where('brokerId', '==', brokerId)
    .limit(500)
    .get();
  const referredUserIds = referralSnap.docs.map((doc) => doc.id);
  if (referredUserIds.length === 0) {
    return {
      success: true,
      scanned: 0,
      created: 0,
      updated: 0,
      skipped: 0,
    };
  }

  const userMaskMap = await getMaskedUserMap(db, referredUserIds);
  let scanned = 0;
  let created = 0;
  let updated = 0;
  let skipped = 0;

  const chunks = [];
  for (let idx = 0; idx < referredUserIds.length; idx += 10) {
    chunks.push(referredUserIds.slice(idx, idx + 10));
  }

  for (const userChunk of chunks) {
    const bidSnap = await db.collection('bids')
      .where('bidderId', 'in', userChunk)
      .limit(300)
      .get();

    for (const bidDoc of bidSnap.docs) {
      scanned += 1;
      const bid = bidDoc.data() || {};
      const listingType = bid.cargoListingId ? 'cargo' : (bid.truckListingId ? 'truck' : null);
      const listingId = bid.cargoListingId || bid.truckListingId || null;
      if (!listingType || !listingId) {
        skipped += 1;
        continue;
      }

      const activityType = listingType === 'truck' ? ACTIVITY_TYPES.TRUCK_BOOKING_BID : ACTIVITY_TYPES.CARGO_BID;
      const eventId = `bid:${bidDoc.id}`;
      const result = await upsertBrokerMarketplaceActivity(eventId, {
        brokerId,
        referredUserId: bid.bidderId,
        activityType,
        listingType,
        bidId: bidDoc.id,
        contractId: null,
        amount: Number(bid.price || 0) || null,
        origin: bid.origin || null,
        destination: bid.destination || null,
        status: String(bid.status || 'pending').toLowerCase(),
        activityAt: bid.updatedAt || bid.createdAt || FieldValue.serverTimestamp(),
        referredUserMasked: userMaskMap[bid.bidderId]?.masked || 'User',
        counterpartyMasked: maskDisplayName(bid.listingOwnerName, null),
        source: 'backfill',
      }, db);
      if (result.created) created += 1;
      else if (result.updated) updated += 1;
    }

    const contractSnap = await db.collection('contracts')
      .where('bidderId', 'in', userChunk)
      .where('listingType', '==', 'truck')
      .limit(300)
      .get();

    for (const contractDoc of contractSnap.docs) {
      scanned += 1;
      const contract = contractDoc.data() || {};
      const status = String(contract.status || '').toLowerCase();
      const phase = status === 'completed'
        ? 'completed'
        : (status === 'cancelled' ? 'cancelled' : (status === 'signed' ? 'signed' : 'created'));
      const eventId = `contract:${contractDoc.id}:${phase}`;
      const result = await upsertBrokerMarketplaceActivity(eventId, {
        brokerId,
        referredUserId: contract.bidderId,
        activityType: mapContractPhaseToType(phase),
        listingType: 'truck',
        bidId: contract.bidId || null,
        contractId: contractDoc.id,
        amount: Number(contract.agreedPrice || 0) || null,
        origin: contract.pickupCity || contract.pickupAddress || null,
        destination: contract.deliveryCity || contract.deliveryAddress || null,
        status,
        activityAt: contract.updatedAt || contract.createdAt || FieldValue.serverTimestamp(),
        referredUserMasked: userMaskMap[contract.bidderId]?.masked || 'User',
        counterpartyMasked: maskDisplayName(contract.listingOwnerName, null),
        source: 'backfill',
      }, db);
      if (result.created) created += 1;
      else if (result.updated) updated += 1;
    }
  }

  await brokerRef.set({
    lastBrokerActivityBackfillAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  return {
    success: true,
    scanned,
    created,
    updated,
    skipped,
  };
});

/**
 * Broker payout request (admin-approved workflow).
 */
exports.brokerRequestPayout = functions.region(REGION).https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  const db = admin.firestore();
  const settings = await loadPlatformSettings(db);
  if (shouldBlockForMaintenance(settings, context?.auth?.token)) {
    throw new functions.https.HttpsError('failed-precondition', 'Platform is currently under maintenance');
  }
  const brokerId = context.auth.uid;
  const amount = roundToCents(data?.amount);
  const method = String(data?.method || 'gcash').toLowerCase();
  const payoutDetails = data?.payoutDetails || {};

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new functions.https.HttpsError('invalid-argument', 'Valid payout amount is required');
  }
  if (amount < MIN_PAYOUT_AMOUNT) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      `Minimum payout amount is PHP ${MIN_PAYOUT_AMOUNT.toLocaleString()}`
    );
  }

  const brokerRef = db.collection('brokers').doc(brokerId);
  const brokerProfileRef = db.collection('users').doc(brokerId).collection('brokerProfile').doc('profile');
  const payoutRef = db.collection('brokerPayoutRequests').doc();
  const now = FieldValue.serverTimestamp();

  await db.runTransaction(async (tx) => {
    const brokerDoc = await tx.get(brokerRef);
    if (!brokerDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Broker profile not found');
    }

    const broker = brokerDoc.data() || {};
    if (broker.status && broker.status !== 'active') {
      throw new functions.https.HttpsError('failed-precondition', 'Broker account is not active');
    }

    const availableBalance = Number(broker.availableBalance || 0);
    if (availableBalance < amount) {
      throw new functions.https.HttpsError('failed-precondition', 'Insufficient available balance');
    }

    tx.set(payoutRef, {
      brokerId,
      amount,
      method,
      payoutDetails,
      status: 'pending',
      requestedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    tx.update(brokerRef, {
      availableBalance: roundToCents(availableBalance - amount),
      pendingEarnings: roundToCents(Number(broker.pendingEarnings || 0) + amount),
      updatedAt: now,
    });

    tx.set(brokerProfileRef, {
      availableBalance: roundToCents(availableBalance - amount),
      pendingEarnings: roundToCents(Number(broker.pendingEarnings || 0) + amount),
      updatedAt: now,
    }, { merge: true });
  });

  await notifyAllAdmins(db, {
    type: 'BROKER_PAYOUT_REVIEW',
    title: 'Broker Payout Request',
    message: `A broker requested payout of PHP ${amount.toLocaleString()}.`,
    data: {
      requestId: payoutRef.id,
      brokerId,
      amount,
      method,
      actionRequired: 'REVIEW_BROKER_PAYOUT',
    },
  });

  return { success: true, requestId: payoutRef.id };
});

/**
 * Admin: list brokers.
 */
exports.adminGetBrokers = functions.region(REGION).https.onCall(async (data, context) => {
  await verifyAdmin(context);

  const db = admin.firestore();
  const limit = Math.min(Math.max(Number(data?.limit || 100), 1), 500);
  const tier = data?.tier && data.tier !== 'all' ? String(data.tier).toUpperCase() : null;

  let query = db.collection('brokers').limit(limit);
  if (tier) {
    query = db.collection('brokers').where('tier', '==', tier).limit(limit);
  }

  const snap = await query.get();
  const brokers = await Promise.all(snap.docs.map(async (doc) => {
    const broker = { id: doc.id, ...doc.data() };
    let user = null;
    try {
      const userDoc = await db.collection('users').doc(doc.id).get();
      if (userDoc.exists) {
        const userData = userDoc.data() || {};
        user = {
          name: userData.name || null,
          phone: userData.phone || null,
          email: userData.email || null,
        };
      }
    } catch (error) {
      // Ignore enrichment errors per user.
    }
    return { ...broker, user };
  }));

  brokers.sort((a, b) => {
    const aSeconds = a.createdAt?.seconds || 0;
    const bSeconds = b.createdAt?.seconds || 0;
    return bSeconds - aSeconds;
  });

  return {
    brokers,
    total: brokers.length,
  };
});

/**
 * Admin: update broker tier.
 */
exports.adminUpdateBrokerTier = functions.region(REGION).https.onCall(async (data, context) => {
  await verifyAdmin(context);

  const brokerId = String(data?.brokerId || '').trim();
  const tier = String(data?.tier || '').trim().toUpperCase();

  if (!brokerId || !tier) {
    throw new functions.https.HttpsError('invalid-argument', 'brokerId and tier are required');
  }
  if (!ALLOWED_TIERS.includes(tier)) {
    throw new functions.https.HttpsError('invalid-argument', `Tier must be one of: ${ALLOWED_TIERS.join(', ')}`);
  }

  const db = admin.firestore();
  const brokerRef = db.collection('brokers').doc(brokerId);
  const brokerProfileRef = db.collection('users').doc(brokerId).collection('brokerProfile').doc('profile');
  const now = FieldValue.serverTimestamp();

  await db.runTransaction(async (tx) => {
    const brokerDoc = await tx.get(brokerRef);
    if (!brokerDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Broker not found');
    }

    tx.update(brokerRef, {
      tier,
      updatedAt: now,
      tierUpdatedAt: now,
      tierUpdatedBy: context.auth.uid,
    });

    tx.set(brokerProfileRef, {
      tier,
      updatedAt: now,
      tierUpdatedAt: now,
      tierUpdatedBy: context.auth.uid,
    }, { merge: true });
  });

  await db.collection('users').doc(brokerId).collection('notifications').add({
    type: 'BROKER_STATUS',
    title: 'Broker Tier Updated',
    message: `Your broker tier has been updated to ${tier}.`,
    data: { tier, updatedBy: context.auth.uid },
    isRead: false,
    createdAt: FieldValue.serverTimestamp(),
  });

  return { success: true };
});

/**
 * Admin: list payout requests.
 */
exports.adminGetBrokerPayoutRequests = functions.region(REGION).https.onCall(async (data, context) => {
  await verifyAdmin(context);

  const db = admin.firestore();
  const limit = Math.min(Math.max(Number(data?.limit || 100), 1), 500);
  const status = String(data?.status || '').trim().toLowerCase();
  const allowedStatuses = new Set(['pending', 'approved', 'rejected', 'all', '']);
  if (!allowedStatuses.has(status)) {
    throw new functions.https.HttpsError('invalid-argument', 'status must be all, pending, approved, or rejected');
  }

  let query = db.collection('brokerPayoutRequests');
  if (status && status !== 'all') {
    query = query.where('status', '==', status);
  }
  query = query.orderBy('createdAt', 'desc').limit(limit);

  const snap = await query.get();
  const requests = await Promise.all(snap.docs.map(async (doc) => {
    const request = { id: doc.id, ...doc.data() };
    let broker = null;
    try {
      const userDoc = await db.collection('users').doc(request.brokerId).get();
      if (userDoc.exists) {
        const user = userDoc.data() || {};
        broker = {
          name: user.name || null,
          phone: user.phone || null,
          email: user.email || null,
        };
      }
    } catch (error) {
      // Ignore enrichment errors per row.
    }
    return { ...request, broker };
  }));

  requests.sort((a, b) => {
    const aSeconds = a.createdAt?.seconds || 0;
    const bSeconds = b.createdAt?.seconds || 0;
    return bSeconds - aSeconds;
  });

  return { requests, total: requests.length };
});

/**
 * Admin: approve/reject payout request.
 */
exports.adminReviewBrokerPayout = functions.region(REGION).https.onCall(async (data, context) => {
  await verifyAdmin(context);

  const requestId = String(data?.requestId || '').trim();
  const decision = String(data?.decision || '').trim().toLowerCase();
  const notes = data?.notes ? String(data.notes).trim() : null;
  const payoutReference = data?.payoutReference ? String(data.payoutReference).trim() : null;

  if (!requestId || !decision) {
    throw new functions.https.HttpsError('invalid-argument', 'requestId and decision are required');
  }
  if (!['approve', 'reject'].includes(decision)) {
    throw new functions.https.HttpsError('invalid-argument', 'decision must be approve or reject');
  }

  const db = admin.firestore();
  const requestRef = db.collection('brokerPayoutRequests').doc(requestId);
  const now = FieldValue.serverTimestamp();

  let brokerId = null;

  await db.runTransaction(async (tx) => {
    const requestDoc = await tx.get(requestRef);
    if (!requestDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Payout request not found');
    }

    const request = requestDoc.data() || {};
    if (request.status !== 'pending') {
      throw new functions.https.HttpsError('failed-precondition', 'Payout request is no longer pending');
    }

    brokerId = request.brokerId;
    const amount = Number(request.amount || 0);

    const brokerRef = db.collection('brokers').doc(brokerId);
    const brokerProfileRef = db.collection('users').doc(brokerId).collection('brokerProfile').doc('profile');
    const brokerDoc = await tx.get(brokerRef);
    if (!brokerDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Broker profile not found');
    }
    const broker = brokerDoc.data() || {};
    const pendingEarnings = Number(broker.pendingEarnings || 0);
    const availableBalance = Number(broker.availableBalance || 0);

    const isApproval = decision === 'approve';
    const nextPending = roundToCents(Math.max(0, pendingEarnings - amount));
    const nextAvailable = isApproval
      ? availableBalance
      : roundToCents(availableBalance + amount);
    const nextStatus = isApproval ? 'approved' : 'rejected';

    tx.update(requestRef, {
      status: nextStatus,
      reviewedAt: now,
      reviewedBy: context.auth.uid,
      reviewNotes: notes || null,
      payoutReference: isApproval ? payoutReference || null : null,
      updatedAt: now,
    });

    tx.update(brokerRef, {
      pendingEarnings: nextPending,
      availableBalance: nextAvailable,
      updatedAt: now,
    });

    tx.set(brokerProfileRef, {
      pendingEarnings: nextPending,
      availableBalance: nextAvailable,
      updatedAt: now,
    }, { merge: true });

    tx.set(db.collection('adminLogs').doc(), {
      action: isApproval ? 'BROKER_PAYOUT_APPROVED' : 'BROKER_PAYOUT_REJECTED',
      targetId: requestId,
      targetUserId: brokerId,
      amount,
      performedBy: context.auth.uid,
      notes: notes || null,
      createdAt: now,
    });
  });

  if (brokerId) {
    await db.collection('users').doc(brokerId).collection('notifications').add({
      type: 'BROKER_PAYOUT_STATUS',
      title: decision === 'approve' ? 'Payout Approved' : 'Payout Rejected',
      message: decision === 'approve'
        ? 'Your payout request has been approved by admin.'
        : 'Your payout request was rejected. The amount has been returned to your available balance.',
      data: { requestId, decision, notes: notes || null },
      isRead: false,
      createdAt: FieldValue.serverTimestamp(),
    });
  }

  return { success: true };
});

/**
 * Admin: broker referral quality report.
 * Highlights contracts cancelled before platform-fee payment where fee payer was referred.
 */
exports.adminGetBrokerReferralReport = functions.region(REGION).https.onCall(async (data, context) => {
  await verifyAdmin(context);

  const db = admin.firestore();
  const scanLimit = Math.min(Math.max(Number(data?.scanLimit || 1000), 100), 5000);
  const recentLimit = Math.min(Math.max(Number(data?.recentLimit || 30), 1), 100);

  const [cancelledContractsSnap, settingsDoc] = await Promise.all([
    db.collection('contracts').where('status', '==', 'cancelled').limit(scanLimit).get(),
    db.collection('settings').doc('platform').get(),
  ]);

  const settings = settingsDoc.exists ? settingsDoc.data() || {} : {};
  const cancelledContracts = cancelledContractsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  const unpaidCancelledContracts = cancelledContracts.filter((contract) => (
    contract.platformFeePaid !== true &&
    !!contract.platformFeePayerId
  ));

  const feePayerIds = [...new Set(unpaidCancelledContracts.map((contract) => contract.platformFeePayerId).filter(Boolean))];
  const referralMap = new Map();
  if (feePayerIds.length > 0) {
    const referralDocs = await db.getAll(
      ...feePayerIds.map((uid) => db.collection('brokerReferrals').doc(uid))
    );
    referralDocs.forEach((doc) => {
      if (doc.exists) {
        referralMap.set(doc.id, doc.data() || {});
      }
    });
  }

  const referredCancelledContracts = unpaidCancelledContracts.filter((contract) =>
    referralMap.has(contract.platformFeePayerId)
  );

  const brokerIds = [...new Set(referredCancelledContracts.map((contract) =>
    referralMap.get(contract.platformFeePayerId)?.brokerId
  ).filter(Boolean))];

  const brokerMap = new Map();
  const brokerUserMap = new Map();
  if (brokerIds.length > 0) {
    const [brokerDocs, brokerUserDocs] = await Promise.all([
      db.getAll(...brokerIds.map((brokerId) => db.collection('brokers').doc(brokerId))),
      db.getAll(...brokerIds.map((brokerId) => db.collection('users').doc(brokerId))),
    ]);

    brokerDocs.forEach((doc) => {
      if (doc.exists) {
        brokerMap.set(doc.id, doc.data() || {});
      }
    });

    brokerUserDocs.forEach((doc) => {
      if (doc.exists) {
        brokerUserMap.set(doc.id, doc.data() || {});
      }
    });
  }

  let totalWaivedPlatformFees = 0;
  let totalEstimatedCommissionLost = 0;
  let cargoCount = 0;
  let truckCount = 0;

  const brokerBreakdownMap = new Map();
  const recentContracts = referredCancelledContracts.map((contract) => {
    const referral = referralMap.get(contract.platformFeePayerId) || {};
    const brokerId = referral.brokerId || null;
    const broker = brokerId ? (brokerMap.get(brokerId) || {}) : {};
    const brokerUser = brokerId ? (brokerUserMap.get(brokerId) || {}) : {};
    const platformFee = Number(contract.platformFee || 0);
    const brokerTier = String(broker.tier || 'STARTER').toUpperCase();
    const commissionRate = resolveCommissionRate(brokerTier, settings);
    const estimatedCommissionLost = roundToCents(platformFee * (commissionRate / 100));

    totalWaivedPlatformFees += platformFee;
    totalEstimatedCommissionLost += estimatedCommissionLost;

    const listingType = String(contract.listingType || '').toLowerCase();
    if (listingType === 'cargo') cargoCount += 1;
    else if (listingType === 'truck') truckCount += 1;

    if (brokerId) {
      const existing = brokerBreakdownMap.get(brokerId) || {
        brokerId,
        brokerName: brokerUser.name || null,
        brokerPhone: brokerUser.phone || null,
        brokerCode: broker.referralCode || null,
        tier: brokerTier,
        contractsCancelledUnpaid: 0,
        waivedPlatformFees: 0,
        estimatedCommissionLost: 0,
      };
      existing.contractsCancelledUnpaid += 1;
      existing.waivedPlatformFees = roundToCents(existing.waivedPlatformFees + platformFee);
      existing.estimatedCommissionLost = roundToCents(existing.estimatedCommissionLost + estimatedCommissionLost);
      brokerBreakdownMap.set(brokerId, existing);
    }

    return {
      contractId: contract.id,
      contractNumber: contract.contractNumber || null,
      listingType: listingType || 'unknown',
      platformFee,
      platformFeeStatus: contract.platformFeeStatus || 'waived',
      platformFeePayerId: contract.platformFeePayerId || null,
      brokerId,
      brokerName: brokerUser.name || null,
      brokerCode: referral.brokerCode || broker.referralCode || null,
      brokerTier,
      commissionRate,
      estimatedCommissionLost,
      cancelledAt: contract.cancelledAt || contract.updatedAt || contract.createdAt || null,
    };
  })
    .sort((a, b) => toTimestampNumber(b.cancelledAt) - toTimestampNumber(a.cancelledAt))
    .slice(0, recentLimit);

  const brokerBreakdown = [...brokerBreakdownMap.values()]
    .sort((a, b) => (
      b.contractsCancelledUnpaid - a.contractsCancelledUnpaid ||
      b.waivedPlatformFees - a.waivedPlatformFees
    ))
    .slice(0, 20);

  return {
    summary: {
      scannedCancelledContracts: cancelledContracts.length,
      unpaidCancelledContracts: unpaidCancelledContracts.length,
      referredCancelledUnpaidContracts: referredCancelledContracts.length,
      cargoCancelledUnpaidContracts: cargoCount,
      truckCancelledUnpaidContracts: truckCount,
      waivedPlatformFees: roundToCents(totalWaivedPlatformFees),
      estimatedCommissionLost: roundToCents(totalEstimatedCommissionLost),
      note: 'Cancelled contracts with unpaid platform fee are waived and do not generate broker commission.',
    },
    recentContracts,
    brokerBreakdown,
  };
});
