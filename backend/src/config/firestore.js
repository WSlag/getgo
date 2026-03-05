import admin from './firebase-admin.js';

// Get Firestore database instance
export const db = admin.firestore();

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
