import { auth, functions, db } from '../firebase';
import { httpsCallable } from 'firebase/functions';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  doc,
  getDoc,
} from 'firebase/firestore';
import {
  getRatingsForUser,
  getRatingsForContract,
  getMyRatings,
  getPaymentSubmission,
} from './firestoreService';

/**
 * Call a Firebase Cloud Function
 * @param {string} name Function name
 * @param {Object} data Payload
 * @returns {Promise<any>} Function result data
 */
function normalizeFunctionErrorCode(error) {
  const rawCode = error?.code;
  if (typeof rawCode !== 'string' || rawCode.trim() === '') return '';
  const normalized = rawCode.includes('/') ? rawCode.split('/').pop() : rawCode;
  return normalized || rawCode;
}

function isTransientFunctionError(error) {
  const code = normalizeFunctionErrorCode(error);
  if (['internal', 'unavailable', 'deadline-exceeded', 'aborted', 'resource-exhausted', 'unknown'].includes(code)) {
    return true;
  }

  const message = String(error?.message || '').toLowerCase();
  return (
    message.includes('err_connection_closed') ||
    message.includes('connection closed') ||
    message.includes('network') ||
    message.includes('failed to fetch')
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callFunction(name, data = {}, options = {}) {
  const fn = httpsCallable(functions, name);
  const retryCount = Number.isInteger(options.retryCount)
    ? Math.min(Math.max(options.retryCount, 0), 3)
    : 0;
  const retryDelayMs = Number.isFinite(options.retryDelayMs)
    ? Math.max(Number(options.retryDelayMs), 100)
    : 300;

  for (let attempt = 0; attempt <= retryCount; attempt += 1) {
    try {
      const result = await fn(data);
      return result.data;
    } catch (error) {
      const normalizedCode = normalizeFunctionErrorCode(error);
      const isExpectedError =
        normalizedCode === 'not-found' ||
        (error.message && error.message.includes('Contract not found'));
      const shouldRetry = attempt < retryCount && isTransientFunctionError(error);

      if (shouldRetry) {
        const jitterMs = Math.floor(Math.random() * 100);
        const delayMs = retryDelayMs * (2 ** attempt) + jitterMs;
        await sleep(delayMs);
        continue;
      }

      if (!isExpectedError) {
        console.error(`Cloud Function ${name} error:`, error);
      }

      const err = new Error(error.message || 'Function call failed');
      err.code = normalizedCode || error.code;
      err.details = error.details || null;
      err.cause = error;
      throw err;
    }
  }

  const err = new Error('Function call failed');
  err.code = 'unknown';
  throw err;
}

const requireAuthUser = () => {
  const user = auth.currentUser;
  if (!user) {
    const err = new Error('Must be authenticated');
    err.code = 'unauthenticated';
    throw err;
  }
  return user;
};

const mapShipment = (docSnap) => {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    ...data,
    createdAt: data.createdAt?.toDate?.() || null,
    updatedAt: data.updatedAt?.toDate?.() || null,
    deliveredAt: data.deliveredAt?.toDate?.() || null,
  };
};

/**
 * Get the current Firebase ID token
 * @returns {Promise<string|null>} The ID token or null if not authenticated
 */
export async function getIdToken() {
  const user = auth.currentUser;
  if (!user) return null;
  try {
    return await user.getIdToken();
  } catch (error) {
    console.error('Error getting ID token:', error);
    return null;
  }
}

// Firebase-backed API surface.
const api = {
  auth: {
    switchRole: (role) => callFunction('switchUserRole', { role }),
    registerBroker: () => callFunction('brokerRegister', {}),
    requestEmailMagicLinkSignInV2: (data) => callFunction('authRequestEmailMagicLinkSignInV2', data || {}),
    getRecoveryStatus: () => callFunction('authGetRecoveryStatus', {}),
    generateRecoveryCodes: () => callFunction('authGenerateRecoveryCodes', {}),
    recoverySignIn: (data) => callFunction('authRecoverySignIn', data || {}),
    prepareEmailMagicLinkSignIn: (data) => callFunction('authPrepareEmailMagicLinkSignIn', data || {}),
    finalizeEmailLinking: (data) => callFunction('authFinalizeEmailLinking', data || {}),
    disableEmailMagicLink: () => callFunction('authDisableEmailMagicLink', {}),
    getCurrentUserProfile: () => callFunction('authGetCurrentUserProfile', {}),
  },

  optimize: {
    findBackload: (params) => callFunction('findBackloadOpportunities', params || {}),
    getPopularRoutes: () => callFunction('getPopularRoutes', {}),
  },

  wallet: {
    createPlatformFeeOrder: (data) => callFunction('createPlatformFeeOrder', data),
    createTopUpOrder: (data) => callFunction('createTopUpOrder', data),
    submitPaymentSubmission: (data) => callFunction('submitPaymentSubmission', data),
    getOrder: (orderId) => callFunction('getOrder', { orderId }),
    getPendingOrders: () => callFunction('getPendingOrders', {}),
    getGcashConfig: () => callFunction('getGcashConfig', {}),
  },

  contracts: {
    getAll: (params) => callFunction('getContracts', params || {}),
    getById: (id) => callFunction('getContract', { contractId: id }),
    getByBid: (bidId) => callFunction('getContractByBid', { bidId }),
    create: (data) => callFunction('createContract', data),
    sign: (id, data = {}) => callFunction('signContract', { contractId: id, ...(data || {}) }),
    complete: (id) => callFunction('completeContract', { contractId: id }),
    cancel: (id, payload = null) => {
      if (payload && typeof payload === 'object') {
        return callFunction('cancelContract', { contractId: id, ...payload });
      }
      return callFunction('cancelContract', { contractId: id, reason: payload });
    },
  },

  bids: {
    updateAgreedPrice: (bidId, agreedPrice) => callFunction('updateBidAgreedPrice', { bidId, agreedPrice }),
  },

  calls: {
    generateToken: (channelName, uid) =>
      callFunction('generateAgoraToken', { channelName, uid }),
    start: (data = {}) => callFunction('startVoiceCall', data || {}),
    answer: (callId) => callFunction('answerVoiceCall', { callId }),
    end: (callId, status, extra = {}) => callFunction('endVoiceCall', { callId, status, ...(extra || {}) }),
    getEligibility: (calleeId) => callFunction('getVoiceCallEligibility', { calleeId }),
  },

  ratings: {
    getForUser: (userId) => getRatingsForUser(userId),
    getForContract: (contractId) => getRatingsForContract(contractId),
    getPending: () => callFunction('getPendingRatings', {}),
    getMyRatings: () => {
      const user = auth.currentUser;
      if (!user) return Promise.resolve([]);
      return getMyRatings(user.uid);
    },
    submit: (data) => callFunction('submitRating', data),
  },

  broker: {
    register: (data = {}) => callFunction('brokerRegister', data),
    applyReferralCode: (referralCode) => callFunction('brokerApplyReferralCode', { referralCode }),
    getDashboard: () => callFunction('brokerGetDashboard', {}),
    requestPayout: (data) => callFunction('brokerRequestPayout', data || {}),
    getReferredUsers: (params = {}) => callFunction('brokerGetReferredUsers', params || {}),
    referListing: (data = {}) => callFunction('brokerReferListing', data || {}),
    getListingReferrals: (params = {}) => callFunction('brokerGetListingReferrals', params || {}),
    getMarketplaceActivity: (params = {}) => callFunction('brokerGetMarketplaceActivity', params || {}),
    backfillMarketplaceActivity: (params = {}) => callFunction('brokerBackfillMarketplaceActivity', params || {}),
  },

  referrals: {
    getMyListingReferrals: (params = {}) => callFunction('referredGetListingReferrals', params || {}),
    updateMyListingReferralState: (data = {}) => callFunction('referredUpdateListingReferralState', data || {}),
  },

  shipments: {
    getAll: async (params = {}) => {
      const user = requireAuthUser();
      let shipmentsQuery = query(
        collection(db, 'shipments'),
        where('participantIds', 'array-contains', user.uid),
        orderBy('createdAt', 'desc')
      );

      if (params?.status) {
        shipmentsQuery = query(
          collection(db, 'shipments'),
          where('participantIds', 'array-contains', user.uid),
          where('status', '==', params.status),
          orderBy('createdAt', 'desc')
        );
      }

      const snapshot = await getDocs(shipmentsQuery);
      return { shipments: snapshot.docs.map(mapShipment) };
    },
    getById: async (shipmentId) => {
      const user = requireAuthUser();
      const shipmentRef = doc(db, 'shipments', shipmentId);
      const shipmentSnap = await getDoc(shipmentRef);

      if (!shipmentSnap.exists()) {
        const err = new Error('Shipment not found');
        err.code = 'not-found';
        throw err;
      }

      const shipment = mapShipment(shipmentSnap);
      if (Array.isArray(shipment.participantIds) && !shipment.participantIds.includes(user.uid)) {
        const err = new Error('Access denied');
        err.code = 'permission-denied';
        throw err;
      }

      return { shipment };
    },
    track: async (trackingNumber) => {
      const snapshot = await getDocs(
        query(collection(db, 'shipments'), where('trackingNumber', '==', trackingNumber), limit(1))
      );

      if (snapshot.empty) {
        const err = new Error('Shipment not found');
        err.code = 'not-found';
        throw err;
      }

      return { shipment: mapShipment(snapshot.docs[0]) };
    },
    updateLocation: (id, data) => callFunction('updateShipmentLocation', { shipmentId: id, ...data }),
    updateStatus: (id, status) => callFunction('updateShipmentStatus', { shipmentId: id, status }),
  },

  admin: {
    getDashboardStats: () => callFunction('adminGetDashboardStats', {}),
    getDashboardOverview: () =>
      callFunction('adminGetDashboardOverview', {}, { retryCount: 2, retryDelayMs: 400 }),
    getSystemSettings: () => callFunction('adminGetSystemSettings', {}),
    updateSystemSettings: (settings) => callFunction('adminUpdateSystemSettings', { settings }),

    getPendingPayments: (params) => callFunction('adminGetPendingPayments', params || {}),
    getPaymentStats: () => callFunction('getPaymentStats', {}),
    approvePayment: (submissionId, data) => callFunction('adminApprovePayment', { submissionId, ...data }),
    rejectPayment: (submissionId, data) => callFunction('adminRejectPayment', { submissionId, ...data }),
    getPaymentDetails: (submissionId) => getPaymentSubmission(submissionId),

    getUsers: (params) => callFunction('adminGetUsers', params || {}),
    suspendUser: (userId, data) => callFunction('adminSuspendUser', { userId, ...data }),
    activateUser: (userId) => callFunction('adminActivateUser', { userId }),
    getTruckerCancellationStatus: (userId) =>
      callFunction('adminGetTruckerCancellationStatus', { userId }),
    unblockTruckerCancellationBlock: (userId, reason) =>
      callFunction('adminUnblockTruckerCancellationBlock', { userId, reason }),
    verifyUser: (userId) => callFunction('adminVerifyUser', { userId }),
    toggleAdmin: (userId, grant) => callFunction('adminToggleAdmin', { userId, grant }),

    getContracts: (params) => callFunction('adminGetContracts', params || {}),
    getListings: (params) => callFunction('adminGetListings', params || {}),
    getRatings: (params) => callFunction('adminGetRatings', params || {}),
    getDisputes: (params) => callFunction('adminGetDisputes', params || {}),
    getShipments: (params) => callFunction('adminGetShipments', params || {}),
    deactivateListing: (listingId, listingType, data = {}) =>
      callFunction('adminDeactivateListing', { listingId, listingType, ...data }),
    deleteRating: (ratingId) => callFunction('adminDeleteRating', { ratingId }),

    getFinancialSummary: () => callFunction('adminGetFinancialSummary', {}),
    getFinancialOverview: (params) => callFunction('adminGetFinancialOverview', params || {}),
    getMarketplaceKpis: (params) => callFunction('adminGetMarketplaceKpis', params || {}),

    resolveDispute: (disputeId, data) => callFunction('adminResolveDispute', { disputeId, ...data }),
    backfillLegacyDisputes: (params) => callFunction('adminBackfillLegacyDisputes', params || {}),

    getBrokers: (params) => callFunction('adminGetBrokers', params || {}),
    updateBrokerTier: (brokerId, tier) => callFunction('adminUpdateBrokerTier', { brokerId, tier }),
    getBrokerReferralReport: (params) => callFunction('adminGetBrokerReferralReport', params || {}),
    reconcileBrokerCommissions: (params) => callFunction('adminReconcileBrokerCommissions', params || {}),
    getBrokerPayoutRequests: (params) => callFunction('adminGetBrokerPayoutRequests', params || {}),
    reviewBrokerPayout: (requestId, decision, data = {}) =>
      callFunction('adminReviewBrokerPayout', { requestId, decision, ...data }),

    getOutstandingFees: (params) => callFunction('adminGetOutstandingFees', params || {}),
    reconcileOutstandingFees: (params) => callFunction('adminReconcileOutstandingFees', params || {}),
  },
};

export default api;
