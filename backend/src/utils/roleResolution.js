const VALID_POSTING_ROLES = new Set(['shipper', 'trucker']);

function normalizeRole(value) {
  return String(value || '').trim().toLowerCase();
}

export function resolveEffectivePostingRole(user = {}) {
  const primaryRole = normalizeRole(user.role);
  if (VALID_POSTING_ROLES.has(primaryRole)) return primaryRole;

  if (primaryRole === 'broker') {
    const brokerSourceRole = normalizeRole(user.brokerSourceRole);
    if (VALID_POSTING_ROLES.has(brokerSourceRole)) return brokerSourceRole;
  }

  return null;
}

export function canCreateListingForType(user = {}, listingType) {
  const normalizedType = normalizeRole(listingType);
  const postingRole = resolveEffectivePostingRole(user);

  if (normalizedType === 'cargo') return postingRole === 'shipper';
  if (normalizedType === 'truck') return postingRole === 'trucker';
  return false;
}

