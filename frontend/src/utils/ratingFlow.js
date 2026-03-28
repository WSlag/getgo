export function isCompletedContractStatus(status) {
  return String(status || '').trim().toLowerCase() === 'completed';
}

export function isRatingRequestNotification(notification) {
  const notificationType = String(notification?.type || '').trim().toUpperCase();
  const contractId = String(notification?.data?.contractId || '').trim();
  return notificationType === 'RATING_REQUEST' && contractId.length > 0;
}

export function resolveRatingTargetFromContract(contract, currentUserId) {
  if (!contract || !currentUserId) return null;

  const isListingOwner = contract.listingOwnerId === currentUserId;
  const isBidder = contract.bidderId === currentUserId;
  if (!isListingOwner && !isBidder) return null;

  const otherUserId = isListingOwner ? contract.bidderId : contract.listingOwnerId;
  if (!otherUserId) return null;

  const otherUserName = isListingOwner
    ? (contract.bidderName || contract.truckerName || 'Counterparty')
    : (contract.listingOwnerName || contract.shipperName || 'Counterparty');

  return {
    contract,
    userToRate: {
      id: otherUserId,
      name: otherUserName,
    },
  };
}
