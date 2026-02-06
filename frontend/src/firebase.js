import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAnalytics } from 'firebase/analytics';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: "AIzaSyDK0-bmmPsuScseGdhN4wj71knEEeicpGs",
  authDomain: "karga-ph.firebaseapp.com",
  projectId: "karga-ph",
  storageBucket: "karga-ph.firebasestorage.app",
  messagingSenderId: "580800488549",
  appId: "1:580800488549:web:3b5051b8c1ec0c8ba9128c",
  measurementId: "G-WHFTRD15XC"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app, 'asia-southeast1');

// Expose functions on window for admin setup (console access)
if (typeof window !== 'undefined') {
  window.firebaseFunctions = functions;
  window.initAdmin = async () => {
    const { httpsCallable } = await import('firebase/functions');
    const initFirstAdmin = httpsCallable(functions, 'initializeFirstAdmin');
    try {
      const result = await initFirstAdmin();
      console.log('SUCCESS:', result.data);
      alert('You are now an admin! Please refresh the page.');
      return result.data;
    } catch (error) {
      console.error('Error:', error.code, error.message);
      alert('Error: ' + error.message);
      throw error;
    }
  };
}

// Initialize Analytics (only in browser)
let analytics = null;
if (typeof window !== 'undefined') {
  analytics = getAnalytics(app);
}
export { analytics };

// Enable offline persistence for Firestore
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') {
    console.warn('Firestore persistence failed: Multiple tabs open');
  } else if (err.code === 'unimplemented') {
    console.warn('Firestore persistence not supported in this browser');
  }
});

export default app;
