const { onDocumentUpdated } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');
const {
  normalizeListingStatus,
  isListingReferable,
  closeListingReferralsByListing,
} = require('../services/brokerListingReferralService');

async function closeReferralsIfListingIneligible(event, listingType) {
  const change = event.data;
  if (!change) return null;
  const before = change.before.data() || {};
  const after = change.after.data() || {};

  const beforeStatus = normalizeListingStatus(before.status);
  const afterStatus = normalizeListingStatus(after.status);
  if (beforeStatus === afterStatus) return null;
  if (isListingReferable(listingType, afterStatus)) return null;

  const db = admin.firestore();
  await closeListingReferralsByListing(db, event.params.listingId, listingType);
  return null;
}

exports.onCargoListingUpdatedForReferrals = onDocumentUpdated(
  {
    region: 'asia-southeast1',
    document: 'cargoListings/{listingId}',
  },
  async (event) => closeReferralsIfListingIneligible(event, 'cargo')
);

exports.onTruckListingUpdatedForReferrals = onDocumentUpdated(
  {
    region: 'asia-southeast1',
    document: 'truckListings/{listingId}',
  },
  async (event) => closeReferralsIfListingIneligible(event, 'truck')
);
