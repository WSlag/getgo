export const WORKSPACE_ROLES = ['shipper', 'trucker', 'broker'];

const ROLE_LABELS = {
  shipper: 'Shipper',
  trucker: 'Trucker',
  broker: 'Broker',
};

export function getWorkspaceLabel(role) {
  return ROLE_LABELS[role] || 'Shipper';
}

export function normalizeWorkspaceRole(role, fallback = 'shipper') {
  if (!role) return fallback;
  const normalized = String(role).toLowerCase();
  return WORKSPACE_ROLES.includes(normalized) ? normalized : fallback;
}

export function resolveEffectivePostingRole(userProfile = {}, fallbackRole = null) {
  const primaryRole = String(userProfile?.role || fallbackRole || '').trim().toLowerCase();
  if (primaryRole === 'shipper' || primaryRole === 'trucker') return primaryRole;

  if (primaryRole === 'broker') {
    const brokerSourceRole = String(userProfile?.brokerSourceRole || '').trim().toLowerCase();
    if (brokerSourceRole === 'shipper' || brokerSourceRole === 'trucker') {
      return brokerSourceRole;
    }
  }

  return null;
}

export function inferContractPerspectiveRole(contract, userId) {
  if (!contract || !userId) return null;
  if (!Array.isArray(contract.participantIds) || !contract.participantIds.includes(userId)) return null;

  const listingType = String(contract.listingType || '').toLowerCase();
  const isListingOwner = contract.listingOwnerId === userId;
  const isBidder = contract.bidderId === userId;

  if (listingType === 'cargo') {
    if (isListingOwner) return 'shipper';
    if (isBidder) return 'trucker';
    return null;
  }

  if (listingType === 'truck') {
    if (isListingOwner) return 'trucker';
    if (isBidder) return 'shipper';
    return null;
  }

  return null;
}

export function inferBidPerspectiveRole(bid, userId) {
  if (!bid || !userId) return null;
  const listingType = String(bid.listingType || '').toLowerCase();
  const isListingOwner = bid.listingOwnerId === userId;
  const isBidder = bid.bidderId === userId;

  if (listingType === 'cargo') {
    if (isListingOwner) return 'shipper';
    if (isBidder) return 'trucker';
    return null;
  }

  if (listingType === 'truck') {
    if (isListingOwner) return 'trucker';
    if (isBidder) return 'shipper';
    return null;
  }

  return null;
}

export function inferConversationPerspectiveRole(conversation, userId) {
  return inferBidPerspectiveRole(conversation, userId);
}

export function inferNotificationWorkspaceRole(notification = {}) {
  const explicitRole = normalizeWorkspaceRole(
    notification.workspaceRole || notification.forRole || notification.role || null,
    null
  );
  if (explicitRole) return explicitRole;

  const type = String(notification.type || '').toLowerCase();
  // Referred recipients (non-broker users) should see broker listing referrals
  // in their normal workspace feeds, not broker-only workspace.
  if (type === 'broker_listing_referral') return null;
  if (type.includes('broker') || type.includes('referral')) return 'broker';

  const listingType = String(notification?.data?.listingType || '').toLowerCase();
  const isCargoListing = listingType === 'cargo';
  const isTruckListing = listingType === 'truck';

  const ownerFocusedPatterns = [
    'new_bid',
    'bid_received',
    'chat_request',
    'new_message_for_owner',
  ];
  if (ownerFocusedPatterns.some((pattern) => type.includes(pattern))) {
    if (isCargoListing) return 'shipper';
    if (isTruckListing) return 'trucker';
  }

  const bidderFocusedPatterns = [
    'bid_accepted',
    'bid_rejected',
    'booking_accepted',
    'booking_rejected',
    'contract_created',
    'contract_signed',
    'contract_completed',
  ];
  if (bidderFocusedPatterns.some((pattern) => type.includes(pattern))) {
    if (isCargoListing) return 'trucker';
    if (isTruckListing) return 'shipper';
  }

  return null;
}
