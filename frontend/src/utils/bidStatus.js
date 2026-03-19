export const CHAT_OPEN_BID_STATUSES = new Set(['pending', 'accepted']);
export const CLOSED_BID_STATUSES = new Set(['rejected', 'cancelled', 'contracted', 'withdrawn']);
export const ACTIVE_BID_STATUSES = new Set(['pending', 'accepted']);

export function normalizeBidStatus(status) {
  return String(status || '').trim().toLowerCase();
}

export function canOpenBidChat(status) {
  return CHAT_OPEN_BID_STATUSES.has(normalizeBidStatus(status));
}

export function isActiveBidStatus(status) {
  return ACTIVE_BID_STATUSES.has(normalizeBidStatus(status));
}

export function isClosedBidStatus(status) {
  return CLOSED_BID_STATUSES.has(normalizeBidStatus(status));
}

export function canSendBidChatMessage(status) {
  return !isClosedBidStatus(status);
}
