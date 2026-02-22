const admin = require('firebase-admin');

const LISTING_REFERRAL_COLLECTION = 'brokerListingReferrals';
const MARKET_ACTIVITY_COLLECTION = 'brokerMarketplaceActivity';
const REFERRAL_AUDIT_COLLECTION = 'brokerListingReferralAudit';

const LISTING_REFERRAL_STATUSES = Object.freeze({
  PENDING: 'pending',
  OPENED: 'opened',
  ACTED: 'acted',
  DISMISSED: 'dismissed',
  EXPIRED: 'expired',
  CLOSED_LISTING: 'closed_listing',
});

const ACTIVE_LISTING_REFERRAL_STATUSES = Object.freeze([
  LISTING_REFERRAL_STATUSES.PENDING,
  LISTING_REFERRAL_STATUSES.OPENED,
]);

const TERMINAL_LISTING_REFERRAL_STATUSES = Object.freeze([
  LISTING_REFERRAL_STATUSES.ACTED,
  LISTING_REFERRAL_STATUSES.DISMISSED,
  LISTING_REFERRAL_STATUSES.EXPIRED,
  LISTING_REFERRAL_STATUSES.CLOSED_LISTING,
]);

const ACTIVITY_TYPES = Object.freeze({
  CARGO_BID: 'cargo_bid',
  TRUCK_BOOKING_BID: 'truck_booking_bid',
  TRUCK_BOOKING_CONTRACT_CREATED: 'truck_booking_contract_created',
  TRUCK_BOOKING_CONTRACT_SIGNED: 'truck_booking_contract_signed',
  TRUCK_BOOKING_CONTRACT_COMPLETED: 'truck_booking_contract_completed',
  TRUCK_BOOKING_CONTRACT_CANCELLED: 'truck_booking_contract_cancelled',
});

const TYPE_FILTERS = new Set(['all', 'cargo_bids', 'truck_bookings', 'contracts']);
const STATUS_FILTERS = new Set(['all', 'pending', 'accepted', 'completed', 'cancelled']);
const REFERRED_STATUS_FILTERS = new Set(['active', 'all', 'acted', 'expired', 'closed']);

const LISTING_STATUS_ALIASES = Object.freeze({
  available: 'open',
  booked: 'contracted',
  'in-transit': 'in_transit',
  intransit: 'in_transit',
  'in-progress': 'in_transit',
  inprogress: 'in_transit',
});

function normalizeListingType(value) {
  const type = String(value || '').trim().toLowerCase();
  return type === 'truck' ? 'truck' : (type === 'cargo' ? 'cargo' : null);
}

function normalizeListingStatus(value) {
  const raw = String(value || '').trim().toLowerCase().replace(/\s+/g, '_');
  if (!raw) return 'open';
  return LISTING_STATUS_ALIASES[raw] || raw;
}

function isListingReferable(listingType, status) {
  const normalizedType = normalizeListingType(listingType);
  const normalizedStatus = normalizeListingStatus(status);
  if (!normalizedType) return false;
  if (normalizedType === 'cargo') {
    return normalizedStatus === 'open' || normalizedStatus === 'waiting';
  }
  return normalizedStatus === 'open' || normalizedStatus === 'waiting' || normalizedStatus === 'in_transit';
}

function sanitizeIdPart(value) {
  return String(value || '').trim().replace(/[^A-Za-z0-9_-]/g, '_');
}

function buildListingReferralId({ brokerId, listingType, listingId, referredUserId }) {
  return [
    sanitizeIdPart(brokerId),
    sanitizeIdPart(listingType),
    sanitizeIdPart(listingId),
    sanitizeIdPart(referredUserId),
  ].join('_');
}

function toDate(value) {
  if (!value) return null;
  if (value.toDate && typeof value.toDate === 'function') return value.toDate();
  if (typeof value.seconds === 'number') return new Date(value.seconds * 1000);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toMillis(value) {
  const dateValue = toDate(value);
  return dateValue ? dateValue.getTime() : 0;
}

function encodeCursor(payload) {
  if (!payload) return null;
  const ts = toMillis(payload.activityAt || payload.updatedAt || payload.createdAt);
  const id = String(payload.id || '').trim();
  if (!id || !ts) return null;
  const raw = JSON.stringify({ ts, id });
  return Buffer.from(raw, 'utf8').toString('base64');
}

function decodeCursor(cursor) {
  const token = String(cursor || '').trim();
  if (!token) return null;
  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf8'));
    if (!decoded || typeof decoded.ts !== 'number' || !decoded.id) return null;
    return { ts: decoded.ts, id: String(decoded.id) };
  } catch (error) {
    return null;
  }
}

function maskPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length < 4) return null;
  const tail = digits.slice(-3);
  return `***${tail}`;
}

function maskDisplayName(name, phone) {
  const normalized = String(name || '').trim();
  if (normalized) {
    const words = normalized.split(/\s+/).filter(Boolean);
    if (words.length === 0) return 'User';
    return words
      .map((word) => `${word.charAt(0).toUpperCase()}***`)
      .join(' ');
  }
  return maskPhone(phone) || 'User';
}

async function getBrokerReferralForUser(userId, db) {
  const uid = String(userId || '').trim();
  if (!uid) return null;
  const referralDoc = await db.collection('brokerReferrals').doc(uid).get();
  if (!referralDoc.exists) return null;
  return { id: referralDoc.id, ...referralDoc.data() };
}

function mapBidActivityType(listingType) {
  return listingType === 'truck' ? ACTIVITY_TYPES.TRUCK_BOOKING_BID : ACTIVITY_TYPES.CARGO_BID;
}

function mapBidStatusToActivityStatus(status) {
  const normalized = String(status || '').trim().toLowerCase();
  if (normalized === 'accepted' || normalized === 'contracted' || normalized === 'signed') return 'accepted';
  if (normalized === 'completed' || normalized === 'delivered') return 'completed';
  if (normalized === 'rejected' || normalized === 'cancelled' || normalized === 'withdrawn') return 'cancelled';
  return 'pending';
}

function normalizeTypeFilter(value) {
  const normalized = String(value || 'all').trim().toLowerCase();
  return TYPE_FILTERS.has(normalized) ? normalized : null;
}

function normalizeStatusFilter(value) {
  const normalized = String(value || 'all').trim().toLowerCase();
  return STATUS_FILTERS.has(normalized) ? normalized : null;
}

function normalizeReferredStatusFilter(value) {
  const normalized = String(value || 'active').trim().toLowerCase();
  return REFERRED_STATUS_FILTERS.has(normalized) ? normalized : null;
}

function matchesTypeFilter(item, typeFilter) {
  if (!item) return false;
  if (!typeFilter || typeFilter === 'all') return true;
  if (typeFilter === 'cargo_bids') return item.activityType === ACTIVITY_TYPES.CARGO_BID;
  if (typeFilter === 'truck_bookings') return item.activityType === ACTIVITY_TYPES.TRUCK_BOOKING_BID;
  if (typeFilter === 'contracts') return String(item.activityType || '').startsWith('truck_booking_contract_');
  return false;
}

function matchesStatusFilter(item, statusFilter) {
  if (!item) return false;
  if (!statusFilter || statusFilter === 'all') return true;
  const normalized = String(item.status || '').trim().toLowerCase();
  if (statusFilter === 'pending') return normalized === 'pending' || normalized === 'draft' || normalized === 'open';
  if (statusFilter === 'accepted') {
    return ['accepted', 'contracted', 'signed', 'in_transit'].includes(normalized);
  }
  if (statusFilter === 'completed') return ['completed', 'delivered'].includes(normalized);
  if (statusFilter === 'cancelled') {
    return ['cancelled', 'rejected', 'withdrawn', 'waived'].includes(normalized);
  }
  return false;
}

function matchesReferredStatusFilter(item, statusFilter) {
  if (!item) return false;
  if (!statusFilter || statusFilter === 'all') return true;
  const normalized = String(item.status || '').trim().toLowerCase();
  if (statusFilter === 'active') return ACTIVE_LISTING_REFERRAL_STATUSES.includes(normalized);
  if (statusFilter === 'acted') return normalized === LISTING_REFERRAL_STATUSES.ACTED;
  if (statusFilter === 'expired') return normalized === LISTING_REFERRAL_STATUSES.EXPIRED;
  if (statusFilter === 'closed') {
    return normalized === LISTING_REFERRAL_STATUSES.CLOSED_LISTING || normalized === LISTING_REFERRAL_STATUSES.DISMISSED;
  }
  return true;
}

function buildBrokerActivitySummary(items = []) {
  const summary = {
    total: items.length,
    byType: {
      cargo_bids: 0,
      truck_bookings: 0,
      contracts: 0,
    },
    byStatus: {
      pending: 0,
      accepted: 0,
      completed: 0,
      cancelled: 0,
      all: items.length,
    },
  };

  items.forEach((item) => {
    if (matchesTypeFilter(item, 'cargo_bids')) summary.byType.cargo_bids += 1;
    if (matchesTypeFilter(item, 'truck_bookings')) summary.byType.truck_bookings += 1;
    if (matchesTypeFilter(item, 'contracts')) summary.byType.contracts += 1;

    if (matchesStatusFilter(item, 'pending')) summary.byStatus.pending += 1;
    if (matchesStatusFilter(item, 'accepted')) summary.byStatus.accepted += 1;
    if (matchesStatusFilter(item, 'completed')) summary.byStatus.completed += 1;
    if (matchesStatusFilter(item, 'cancelled')) summary.byStatus.cancelled += 1;
  });

  return summary;
}

async function upsertBrokerMarketplaceActivity(eventId, payload, db) {
  const id = String(eventId || '').trim();
  if (!id) throw new Error('eventId is required');

  const now = admin.firestore.FieldValue.serverTimestamp();
  const ref = db.collection(MARKET_ACTIVITY_COLLECTION).doc(id);
  const existingDoc = await ref.get();
  const basePayload = {
    ...payload,
    updatedAt: now,
  };
  if (!existingDoc.exists) {
    await ref.set({
      ...basePayload,
      createdAt: now,
    });
    return { created: true, updated: false };
  }
  await ref.set(basePayload, { merge: true });
  return { created: false, updated: true };
}

async function upsertBrokerListingReferral(referralId, payload, db) {
  const id = String(referralId || '').trim();
  if (!id) throw new Error('referralId is required');

  const now = admin.firestore.FieldValue.serverTimestamp();
  const ref = db.collection(LISTING_REFERRAL_COLLECTION).doc(id);
  const existingDoc = await ref.get();
  if (!existingDoc.exists) {
    await ref.set({
      ...payload,
      createdAt: now,
      updatedAt: now,
    });
    return { created: true, updated: false, existing: null };
  }

  await ref.set({
    ...payload,
    updatedAt: now,
  }, { merge: true });
  return { created: false, updated: true, existing: existingDoc.data() || null };
}

async function logReferralAudit(db, eventType, actorId, referralDocId, metadata = {}) {
  await db.collection(REFERRAL_AUDIT_COLLECTION).add({
    eventType: String(eventType || 'unknown'),
    actorId: String(actorId || ''),
    referralDocId: String(referralDocId || ''),
    metadata,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  });
}

async function closeListingReferralsByListing(db, listingId, listingType) {
  const normalizedType = normalizeListingType(listingType);
  if (!normalizedType || !listingId) return 0;

  const querySnap = await db.collection(LISTING_REFERRAL_COLLECTION)
    .where('listingId', '==', listingId)
    .where('listingType', '==', normalizedType)
    .where('status', 'in', ACTIVE_LISTING_REFERRAL_STATUSES)
    .get();

  if (querySnap.empty) return 0;

  const batch = db.batch();
  querySnap.docs.forEach((docSnap) => {
    batch.update(docSnap.ref, {
      status: LISTING_REFERRAL_STATUSES.CLOSED_LISTING,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    batch.set(db.collection(REFERRAL_AUDIT_COLLECTION).doc(), {
      eventType: 'close_listing',
      actorId: 'system',
      referralDocId: docSnap.id,
      metadata: {
        listingId,
        listingType: normalizedType,
      },
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
  });
  await batch.commit();
  return querySnap.size;
}

module.exports = {
  ACTIVITY_TYPES,
  LISTING_REFERRAL_COLLECTION,
  MARKET_ACTIVITY_COLLECTION,
  REFERRAL_AUDIT_COLLECTION,
  LISTING_REFERRAL_STATUSES,
  ACTIVE_LISTING_REFERRAL_STATUSES,
  TERMINAL_LISTING_REFERRAL_STATUSES,
  normalizeListingType,
  normalizeListingStatus,
  isListingReferable,
  buildListingReferralId,
  toDate,
  toMillis,
  encodeCursor,
  decodeCursor,
  maskDisplayName,
  getBrokerReferralForUser,
  mapBidActivityType,
  mapBidStatusToActivityStatus,
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
  closeListingReferralsByListing,
};
