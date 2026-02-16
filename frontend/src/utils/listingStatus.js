export const LISTING_STATUS = Object.freeze({
  OPEN: 'open',
  WAITING: 'waiting',
  NEGOTIATING: 'negotiating',
  CONTRACTED: 'contracted',
  IN_TRANSIT: 'in_transit',
  DELIVERED: 'delivered',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  OFFLINE: 'offline',
});

const STATUS_ALIASES = Object.freeze({
  available: LISTING_STATUS.OPEN,
  booked: LISTING_STATUS.CONTRACTED,
  'in-transit': LISTING_STATUS.IN_TRANSIT,
  intransit: LISTING_STATUS.IN_TRANSIT,
  'in-progress': LISTING_STATUS.IN_TRANSIT,
  inprogress: LISTING_STATUS.IN_TRANSIT,
});

export function normalizeListingStatus(value) {
  const raw = String(value || '').trim().toLowerCase().replace(/\s+/g, '_');
  if (!raw) {
    return LISTING_STATUS.OPEN;
  }
  return STATUS_ALIASES[raw] || raw;
}

export function matchesMarketplaceFilter(status, filterStatus) {
  if (!filterStatus || filterStatus === 'all') {
    return true;
  }

  const normalized = normalizeListingStatus(status);
  if (filterStatus === 'open') {
    return normalized === LISTING_STATUS.OPEN;
  }

  if (filterStatus === 'waiting') {
    return normalized === LISTING_STATUS.WAITING || normalized === LISTING_STATUS.IN_TRANSIT;
  }

  return normalized === normalizeListingStatus(filterStatus);
}

export function canBookTruckStatus(status) {
  const normalized = normalizeListingStatus(status);
  return normalized === LISTING_STATUS.OPEN || normalized === LISTING_STATUS.WAITING || normalized === LISTING_STATUS.IN_TRANSIT;
}

export function canBidCargoStatus(status) {
  const normalized = normalizeListingStatus(status);
  return normalized === LISTING_STATUS.OPEN || normalized === LISTING_STATUS.WAITING;
}

export function toTruckUiStatus(status) {
  const normalized = normalizeListingStatus(status);
  if (normalized === LISTING_STATUS.OPEN) {
    return 'available';
  }
  if (normalized === LISTING_STATUS.IN_TRANSIT || normalized === LISTING_STATUS.WAITING) {
    return 'in-transit';
  }
  if (normalized === LISTING_STATUS.CONTRACTED) {
    return 'booked';
  }
  return normalized;
}
