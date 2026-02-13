import admin from './firebase-admin.js';

const FIRESTORE_NOT_CONFIGURED_ERROR =
  'Firestore Admin is not configured. Provide Firebase Admin credentials to enable backend Firestore routes.';

let loggedMissingConfigWarning = false;

const getDbOrThrow = () => {
  try {
    return admin.firestore();
  } catch (error) {
    if (!loggedMissingConfigWarning) {
      loggedMissingConfigWarning = true;
      console.warn(FIRESTORE_NOT_CONFIGURED_ERROR);
    }
    throw new Error(FIRESTORE_NOT_CONFIGURED_ERROR);
  }
};

// Lazily resolve Firestore to avoid crashing process startup when Admin SDK is not configured.
export const db = new Proxy({}, {
  get(_target, property) {
    const firestore = getDbOrThrow();
    const value = firestore[property];
    return typeof value === 'function' ? value.bind(firestore) : value;
  },
});

/**
 * Helper to get user document from Firestore
 * @param {string} uid - Firebase UID
 * @returns {Promise<Object|null>} User object with id field, or null if not found
 */
export const getUserDoc = async (uid) => {
  const userDoc = await db.collection('users').doc(uid).get();
  return userDoc.exists ? { id: uid, ...userDoc.data() } : null;
};

/**
 * Helper to query a Firestore collection with filters
 * @param {string} collectionName - Name of the collection
 * @param {Array} filters - Array of filter objects: [{ field, operator, value }]
 * @returns {Promise<Array>} Array of documents with id field
 */
export const queryCollection = async (collectionName, filters = []) => {
  let query = db.collection(collectionName);

  filters.forEach(({ field, operator, value }) => {
    query = query.where(field, operator, value);
  });

  const snapshot = await query.get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

/**
 * Helper to get a single document from Firestore
 * @param {string} collectionName - Name of the collection
 * @param {string} docId - Document ID
 * @returns {Promise<Object|null>} Document object with id field, or null if not found
 */
export const getDoc = async (collectionName, docId) => {
  const docSnapshot = await db.collection(collectionName).doc(docId).get();
  return docSnapshot.exists ? { id: docSnapshot.id, ...docSnapshot.data() } : null;
};

export default db;
