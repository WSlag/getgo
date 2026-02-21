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
async function callFunction(name, data = {}) {
  const fn = httpsCallable(functions, name);
  try {
    const result = await fn(data);
    return result.data;
  } catch (error) {
    const isExpectedError =
      error.code === 'not-found' ||
      (error.message && error.message.includes('Contract not found'));

    if (!isExpectedError) {
      console.error(`Cloud Function ${name} error:`, error);
    }

    const err = new Error(error.message || 'Function call failed');
    err.code = error.code;
    throw err;
  }
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
    getRecoveryStatus: () => callFunction('authGetRecoveryStatus', {}),
    generateRecoveryCodes: () => callFunction('authGenerateRecoveryCodes', {}),
    recoverySignIn: (data) => callFunction('authRecoverySignIn', data || {}),
  },

  optimize: {
    findBackload: (params) => callFunction('findBackloadOpportunities', params || {}),
    getPopularRoutes: () => callFunction('getPopularRoutes', {}),
    requestChat: (data) => callFunction('requestListingChat', data || {}),
  },

  wallet: {
    createPlatformFeeOrder: (data) => callFunction('createPlatformFeeOrder', data),
    createTopUpOrder: (data) => callFunction('createTopUpOrder', data),
    getOrder: (orderId) => callFunction('getOrder', { orderId }),
    getPendingOrders: () => callFunction('getPendingOrders', {}),
    getGcashConfig: () => callFunction('getGcashConfig', {}),
  },

  contracts: {
    getAll: (params) => callFunction('getContracts', params || {}),
    getById: (id) => callFunction('getContract', { contractId: id }),
    getByBid: (bidId) => callFunction('getContractByBid', { bidId }),
    create: (data) => callFunction('createContract', data),
    sign: (id) => callFunction('signContract', { contractId: id }),
    complete: (id) => callFunction('completeContract', { contractId: id }),
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

    getPendingPayments: (params) => callFunction('adminGetPendingPayments', params || {}),
    getPaymentStats: () => callFunction('getPaymentStats', {}),
    approvePayment: (submissionId, data) => callFunction('adminApprovePayment', { submissionId, ...data }),
    rejectPayment: (submissionId, data) => callFunction('adminRejectPayment', { submissionId, ...data }),
    getPaymentDetails: (submissionId) => getPaymentSubmission(submissionId),

    getUsers: (params) => callFunction('adminGetUsers', params || {}),
    suspendUser: (userId, data) => callFunction('adminSuspendUser', { userId, ...data }),
    activateUser: (userId) => callFunction('adminActivateUser', { userId }),
    verifyUser: (userId) => callFunction('adminVerifyUser', { userId }),
    toggleAdmin: (userId, grant) => callFunction('adminToggleAdmin', { userId, grant }),

    getContracts: (params) => callFunction('adminGetContracts', params || {}),
    deactivateListing: (listingId, listingType, data = {}) =>
      callFunction('adminDeactivateListing', { listingId, listingType, ...data }),
    deleteRating: (ratingId) => callFunction('adminDeleteRating', { ratingId }),

    getFinancialSummary: () => callFunction('adminGetFinancialSummary', {}),
    getMarketplaceKpis: (params) => callFunction('adminGetMarketplaceKpis', params || {}),

    resolveDispute: (disputeId, data) => callFunction('adminResolveDispute', { disputeId, ...data }),

    getBrokers: (params) => callFunction('adminGetBrokers', params || {}),
    updateBrokerTier: (brokerId, tier) => callFunction('adminUpdateBrokerTier', { brokerId, tier }),
    getBrokerPayoutRequests: (params) => callFunction('adminGetBrokerPayoutRequests', params || {}),
    reviewBrokerPayout: (requestId, decision, data = {}) =>
      callFunction('adminReviewBrokerPayout', { requestId, decision, ...data }),

    getOutstandingFees: (params) => callFunction('adminGetOutstandingFees', params || {}),
  },
};

export default api;
