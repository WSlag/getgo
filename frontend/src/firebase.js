import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  memoryLocalCache,
  connectFirestoreEmulator,
} from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { getAnalytics } from 'firebase/analytics';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

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

// Detect emulator mode from environment variable
const useEmulator = import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true';

// Initialize services
export const auth = getAuth(app);
export const db = (() => {
  try {
    // Use memory cache in emulator mode to avoid persistence conflicts
    if (useEmulator) {
      return initializeFirestore(app, { localCache: memoryLocalCache() });
    }
    return initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
  } catch (err) {
    console.warn('Firestore persistent cache unavailable, using memory cache:', err?.message || err);
    return initializeFirestore(app, { localCache: memoryLocalCache() });
  }
})();
export const storage = getStorage(app);
export const functions = getFunctions(app, 'asia-southeast1');

// Connect to Firebase Emulators if in test mode
if (useEmulator) {
  const emulatorHost = import.meta.env.VITE_FIREBASE_EMULATOR_HOST || '127.0.0.1';

  console.log('🧪 Connecting to Firebase Emulators...');

  connectAuthEmulator(auth, `http://${emulatorHost}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, emulatorHost, 8080);
  connectFunctionsEmulator(functions, emulatorHost, 5001);
  connectStorageEmulator(storage, emulatorHost, 9199);

  console.log('✅ Connected to Firebase Emulators');
}

// Intentionally do not expose admin bootstrap callables on window.
// First-admin initialization must be done through secure operational tooling.

// Initialize Analytics (only in browser and not in test mode)
let analytics = null;
if (typeof window !== 'undefined' && !useEmulator) {
  analytics = getAnalytics(app);
}
export { analytics };

export default app;
