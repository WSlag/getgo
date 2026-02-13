import admin from 'firebase-admin';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

// Initialize Firebase Admin SDK
let firebaseApp = null;

const initializeFirebaseAdmin = () => {
  if (firebaseApp) {
    return firebaseApp;
  }

  try {
    // Option 1: Use environment variable with JSON content
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log('Firebase Admin initialized with FIREBASE_SERVICE_ACCOUNT');
    }
    // Option 2: Use explicit file path from environment variable
    else if (process.env.FIREBASE_SERVICE_ACCOUNT_FILE) {
      const serviceAccountPath = resolve(process.env.FIREBASE_SERVICE_ACCOUNT_FILE);
      if (!existsSync(serviceAccountPath)) {
        throw new Error('FIREBASE_SERVICE_ACCOUNT_FILE does not exist');
      }

      const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log('Firebase Admin initialized with FIREBASE_SERVICE_ACCOUNT_FILE');
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
    // Option 4: Use ADC (Google Cloud runtime) if available
    else if (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.K_SERVICE || process.env.FUNCTION_TARGET) {
      firebaseApp = admin.initializeApp();
      console.log('Firebase Admin initialized with Application Default Credentials');
    } else {
      console.warn('No Firebase credentials found. Firebase Admin features will be disabled.');
      console.warn('To enable Firebase Admin:');
      console.warn('1. Set FIREBASE_SERVICE_ACCOUNT (JSON)');
      console.warn('2. Or set FIREBASE_SERVICE_ACCOUNT_FILE to an absolute path');
      console.warn('3. Or set FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY');
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

export { admin };
export default admin;
