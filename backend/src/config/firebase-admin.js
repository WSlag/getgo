import admin from 'firebase-admin';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Firebase Admin SDK
let firebaseApp = null;

const initializeFirebaseAdmin = () => {
  if (firebaseApp) {
    return firebaseApp;
  }

  try {
    // Option 1: Use service account JSON file
    const serviceAccountPath = join(__dirname, '../../serviceAccountKey.json');

    if (existsSync(serviceAccountPath)) {
      const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log('Firebase Admin initialized with service account file');
    }
    // Option 2: Use environment variable with JSON content
    else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log('Firebase Admin initialized with environment variable');
    }
    // Option 3: Use individual environment variables
    else if (process.env.FIREBASE_PROJECT_ID) {
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
        })
      });
      console.log('Firebase Admin initialized with individual env variables');
    }
    // Option 4: Use Application Default Credentials (for Google Cloud environments)
    else {
      console.warn('⚠️  No Firebase credentials found. Firebase Admin features will be disabled.');
      console.warn('   To enable Firebase Admin:');
      console.warn('   1. Download service account key from Firebase Console');
      console.warn('   2. Save as backend/serviceAccountKey.json');
      console.warn('   3. Or set FIREBASE_SERVICE_ACCOUNT environment variable');
      return null;
    }

    return firebaseApp;
  } catch (error) {
    console.error('Failed to initialize Firebase Admin:', error.message);
    throw error;
  }
};

// Verify Firebase ID token
export const verifyFirebaseToken = async (idToken) => {
  if (!firebaseApp) {
    const result = initializeFirebaseAdmin();
    if (!result) {
      // Firebase Admin not configured, return error
      return {
        valid: false,
        error: 'Firebase Admin not configured. Please add service account credentials.'
      };
    }
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    return {
      valid: true,
      uid: decodedToken.uid,
      phone: decodedToken.phone_number,
      email: decodedToken.email,
      decodedToken
    };
  } catch (error) {
    console.error('Token verification failed:', error.message);
    return {
      valid: false,
      error: error.message
    };
  }
};

// Get user info from Firebase
export const getFirebaseUser = async (uid) => {
  if (!firebaseApp) {
    initializeFirebaseAdmin();
  }

  try {
    const userRecord = await admin.auth().getUser(uid);
    return userRecord;
  } catch (error) {
    console.error('Failed to get user:', error.message);
    return null;
  }
};

// Initialize on import (will warn if no credentials found)
try {
  initializeFirebaseAdmin();
} catch (error) {
  console.error('Firebase Admin initialization error:', error.message);
}

export { admin };
export default admin;
