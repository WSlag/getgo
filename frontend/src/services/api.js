import { auth, functions } from '../firebase';
import { httpsCallable } from 'firebase/functions';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

/**
 * Call a Cloud Function
 * @param {string} name - Function name
 * @param {Object} data - Data to pass to function
 * @returns {Promise<any>} Function result
 */
async function callFunction(name, data = {}) {
  const fn = httpsCallable(functions, name);
  try {
    const result = await fn(data);
    return result.data;
  } catch (error) {
    console.error(`Cloud Function ${name} error:`, error);
    throw new Error(error.message || 'Function call failed');
  }
}

/**
 * API Client with Firebase Authentication
 *
 * Automatically attaches Firebase ID token to requests
 * for backend verification via Firebase Admin SDK
 */

/**
 * Get the current Firebase ID token
 * @returns {Promise<string|null>} The ID token or null if not authenticated
 */
async function getIdToken() {
  const user = auth.currentUser;
  if (!user) {
    return null;
  }
  try {
    return await user.getIdToken();
  } catch (error) {
    console.error('Error getting ID token:', error);
    return null;
  }
}

/**
 * Make an authenticated API request
 * @param {string} endpoint - API endpoint (e.g., '/listings/cargo')
 * @param {Object} options - Fetch options
 * @returns {Promise<Response>}
 */
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;

  // Get Firebase token if user is authenticated
  const token = await getIdToken();

  // Build headers
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  // Add authorization header if token exists
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  return response;
}

/**
 * Make a GET request
 * @param {string} endpoint
 * @param {Object} options
 * @returns {Promise<any>}
 */
export async function get(endpoint, options = {}) {
  const response = await apiRequest(endpoint, {
    method: 'GET',
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }

  return response.json();
}

/**
 * Make a POST request
 * @param {string} endpoint
 * @param {Object} data
 * @param {Object} options
 * @returns {Promise<any>}
 */
export async function post(endpoint, data, options = {}) {
  const response = await apiRequest(endpoint, {
    method: 'POST',
    body: JSON.stringify(data),
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }

  return response.json();
}

/**
 * Make a PUT request
 * @param {string} endpoint
 * @param {Object} data
 * @param {Object} options
 * @returns {Promise<any>}
 */
export async function put(endpoint, data, options = {}) {
  const response = await apiRequest(endpoint, {
    method: 'PUT',
    body: JSON.stringify(data),
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }

  return response.json();
}

/**
 * Make a DELETE request
 * @param {string} endpoint
 * @param {Object} options
 * @returns {Promise<any>}
 */
export async function del(endpoint, options = {}) {
  const response = await apiRequest(endpoint, {
    method: 'DELETE',
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }

  return response.json();
}

/**
 * API helper object with all methods
 */
const api = {
  get,
  post,
  put,
  delete: del,

  // Specific endpoints
  auth: {
    getProfile: () => get('/auth/me'),
    updateProfile: (data) => put('/auth/me', data),
    switchRole: (role) => post('/auth/switch-role', { role }),
    registerBroker: () => post('/auth/register-broker', {}),
  },

  listings: {
    getCargo: (params) => get(`/listings/cargo${params ? `?${new URLSearchParams(params)}` : ''}`),
    getTrucks: (params) => get(`/listings/trucks${params ? `?${new URLSearchParams(params)}` : ''}`),
    getCargoById: (id) => get(`/listings/cargo/${id}`),
    getTruckById: (id) => get(`/listings/trucks/${id}`),
    createCargo: (data) => post('/listings/cargo', data),
    createTruck: (data) => post('/listings/trucks', data),
    updateCargo: (id, data) => put(`/listings/cargo/${id}`, data),
    updateTruck: (id, data) => put(`/listings/trucks/${id}`, data),
    deleteCargo: (id) => del(`/listings/cargo/${id}`),
    deleteTruck: (id) => del(`/listings/trucks/${id}`),
  },

  // Route Optimization / Backload Finder
  optimize: {
    findBackload: (params) => callFunction('findBackloadOpportunities', params || {}),
    getPopularRoutes: () => callFunction('getPopularRoutes', {}),
  },

  bids: {
    create: (data) => post('/bids', data),
    getMyBids: () => get('/bids/my'),
    accept: (bidId) => put(`/bids/${bidId}/accept`, {}),
    reject: (bidId) => put(`/bids/${bidId}/reject`, {}),
  },

  wallet: {
    // Platform fee payment via GCash
    createPlatformFeeOrder: (data) => callFunction('createPlatformFeeOrder', data),
    // GCash order management
    createTopUpOrder: (data) => callFunction('createTopUpOrder', data),
    getOrder: (orderId) => get(`/wallet/order/${orderId}`),
    getPendingOrders: () => get('/wallet/pending-orders'),
    getGcashConfig: () => callFunction('getGcashConfig', {}),
    // Legacy wallet functions removed:
    // - getBalance, getTransactions, topUp, payout, payPlatformFee, getFeeStatus, getPaymentMethods
  },

  chat: {
    getMessages: (bidId) => get(`/chat/${bidId}`),
    sendMessage: (bidId, message) => post(`/chat/${bidId}`, { message }),
    markAsRead: (bidId) => put(`/chat/${bidId}/read`, {}),
    getUnreadCount: () => get('/chat/unread/count'),
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
    getForUser: (userId, params) => get(`/ratings/user/${userId}${params ? `?${new URLSearchParams(params)}` : ''}`),
    getForContract: (contractId) => get(`/ratings/contract/${contractId}`),
    getPending: () => callFunction('getPendingRatings', {}),
    getMyRatings: () => get('/ratings/my-ratings'),
    submit: (data) => callFunction('submitRating', data),
  },

  // Shipment Tracking
  shipments: {
    getAll: (params) => get(`/shipments${params ? `?${new URLSearchParams(params)}` : ''}`),
    getById: (id) => get(`/shipments/${id}`),
    track: (trackingNumber) => get(`/shipments/track/${trackingNumber}`),
    updateLocation: (id, data) => callFunction('updateShipmentLocation', { shipmentId: id, ...data }),
    updateStatus: (id, status) => callFunction('updateShipmentStatus', { shipmentId: id, status }),
  },

  // Admin Endpoints
  admin: {
    // Dashboard
    getDashboardStats: () => callFunction('adminGetDashboardStats', {}),

    // Payments
    getPendingPayments: (params) => callFunction('adminGetPendingPayments', params || {}),
    getPayments: (params) => get(`/admin/payments${params ? `?${new URLSearchParams(params)}` : ''}`),
    getPaymentStats: () => callFunction('getPaymentStats', {}),
    getPaymentDetails: (submissionId) => get(`/admin/payments/${submissionId}`),
    approvePayment: (submissionId, data) => callFunction('adminApprovePayment', { submissionId, ...data }),
    rejectPayment: (submissionId, data) => callFunction('adminRejectPayment', { submissionId, ...data }),

    // Users
    getUsers: (params) => callFunction('adminGetUsers', params || {}),
    getUserDetails: (userId) => get(`/admin/users/${userId}`),
    suspendUser: (userId, data) => callFunction('adminSuspendUser', { userId, ...data }),
    activateUser: (userId) => callFunction('adminActivateUser', { userId }),
    verifyUser: (userId) => callFunction('adminVerifyUser', { userId }),
    toggleAdmin: (userId, grant) => callFunction('adminToggleAdmin', { userId, grant }),

    // Listings
    getListings: (params) => get(`/admin/listings${params ? `?${new URLSearchParams(params)}` : ''}`),
    deactivateListing: (listingId, data) => post(`/admin/listings/${listingId}/deactivate`, data),

    // Contracts
    getContracts: (params) => callFunction('adminGetContracts', params || {}),
    getContractDetails: (contractId) => get(`/admin/contracts/${contractId}`),

    // Shipments
    getShipments: (params) => get(`/admin/shipments${params ? `?${new URLSearchParams(params)}` : ''}`),
    getActiveShipments: () => get('/admin/shipments/active'),

    // Financial
    getFinancialSummary: () => callFunction('adminGetFinancialSummary', {}),
    getTransactions: (params) => get(`/admin/financial/transactions${params ? `?${new URLSearchParams(params)}` : ''}`),

    // Disputes
    getDisputes: (params) => get(`/admin/disputes${params ? `?${new URLSearchParams(params)}` : ''}`),
    getDisputeDetails: (disputeId) => get(`/admin/disputes/${disputeId}`),
    resolveDispute: (disputeId, data) => callFunction('adminResolveDispute', { disputeId, ...data }),

    // Referrals/Brokers
    getBrokers: (params) => get(`/admin/referrals/brokers${params ? `?${new URLSearchParams(params)}` : ''}`),
    updateBrokerTier: (brokerId, tier) => post(`/admin/referrals/${brokerId}/tier`, { tier }),

    // Ratings
    getRatings: (params) => get(`/admin/ratings${params ? `?${new URLSearchParams(params)}` : ''}`),
    deleteRating: (ratingId, data) => del(`/admin/ratings/${ratingId}`, { body: JSON.stringify(data) }),

    // Settings
    getSettings: () => get('/admin/settings'),
    updateSettings: (settings) => put('/admin/settings', { settings }),
  },
};

export default api;
