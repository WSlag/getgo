import { auth } from '../firebase';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

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
    findBackload: (params) => get(`/listings/optimize/backload${params ? `?${new URLSearchParams(params)}` : ''}`),
    getPopularRoutes: () => get('/listings/optimize/popular-routes'),
  },

  bids: {
    create: (data) => post('/bids', data),
    getMyBids: () => get('/bids/my'),
    accept: (bidId) => post(`/bids/${bidId}/accept`, {}),
    reject: (bidId) => post(`/bids/${bidId}/reject`, {}),
  },

  wallet: {
    getBalance: () => get('/wallet'),
    getTransactions: () => get('/wallet/transactions'),
  },

  chat: {
    getMessages: (bidId) => get(`/chat/${bidId}`),
    sendMessage: (bidId, message) => post(`/chat/${bidId}`, { message }),
    markAsRead: (bidId) => put(`/chat/${bidId}/read`, {}),
    getUnreadCount: () => get('/chat/unread/count'),
  },

  contracts: {
    getAll: (params) => get(`/contracts${params ? `?${new URLSearchParams(params)}` : ''}`),
    getById: (id) => get(`/contracts/${id}`),
    getByBid: (bidId) => get(`/contracts/bid/${bidId}`),
    create: (data) => post('/contracts', data),
    sign: (id) => put(`/contracts/${id}/sign`, {}),
    complete: (id) => put(`/contracts/${id}/complete`, {}),
  },

  ratings: {
    getForUser: (userId, params) => get(`/ratings/user/${userId}${params ? `?${new URLSearchParams(params)}` : ''}`),
    getForContract: (contractId) => get(`/ratings/contract/${contractId}`),
    getPending: () => get('/ratings/pending'),
    getMyRatings: () => get('/ratings/my-ratings'),
    submit: (data) => post('/ratings', data),
  },

  // Shipment Tracking
  shipments: {
    getAll: (params) => get(`/shipments${params ? `?${new URLSearchParams(params)}` : ''}`),
    getById: (id) => get(`/shipments/${id}`),
    track: (trackingNumber) => get(`/shipments/track/${trackingNumber}`),
    updateLocation: (id, data) => put(`/shipments/${id}/location`, data),
    updateStatus: (id, status) => put(`/shipments/${id}/status`, { status }),
  },
};

export default api;
