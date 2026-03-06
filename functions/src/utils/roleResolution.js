function normalizeRole(value) {
  return String(value || '').trim().toLowerCase();
}

function resolveEffectivePostingRole(user = {}) {
  const role = normalizeRole(user.role);
  if (role === 'shipper' || role === 'trucker') return role;

  if (role === 'broker') {
    const brokerSourceRole = normalizeRole(user.brokerSourceRole);
    if (brokerSourceRole === 'shipper' || brokerSourceRole === 'trucker') {
      return brokerSourceRole;
    }
  }

  return null;
}

function requiredRecipientRoleForListingType(listingType) {
  const normalizedType = String(listingType || '').trim().toLowerCase();
  if (normalizedType === 'cargo') return 'trucker';
  if (normalizedType === 'truck') return 'shipper';
  return null;
}

function evaluateRecipientEligibilityForListingType(listingType, user = {}) {
  const requiredRole = requiredRecipientRoleForListingType(listingType);
  const currentRole = normalizeRole(user.role);
  if (!requiredRole) {
    return { isEligible: false, ineligibleReason: 'invalid-listing-type', requiredRole: null, currentRole: currentRole || null };
  }
  if (!currentRole) {
    return { isEligible: false, ineligibleReason: 'missing-role', requiredRole, currentRole: null };
  }
  if (currentRole !== requiredRole) {
    return { isEligible: false, ineligibleReason: 'role-mismatch', requiredRole, currentRole };
  }
  return { isEligible: true, ineligibleReason: null, requiredRole, currentRole };
}

module.exports = {
  normalizeRole,
  resolveEffectivePostingRole,
  requiredRecipientRoleForListingType,
  evaluateRecipientEligibilityForListingType,
};

