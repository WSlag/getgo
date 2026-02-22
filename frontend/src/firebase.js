import { initializeApp, setLogLevel } from 'firebase/app';
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
import { initializeAppCheck, ReCaptchaEnterpriseProvider, ReCaptchaV3Provider } from 'firebase/app-check';

const firebaseEnvMap = {
  apiKey: 'VITE_FIREBASE_API_KEY',
  authDomain: 'VITE_FIREBASE_AUTH_DOMAIN',
  projectId: 'VITE_FIREBASE_PROJECT_ID',
  storageBucket: 'VITE_FIREBASE_STORAGE_BUCKET',
  messagingSenderId: 'VITE_FIREBASE_MESSAGING_SENDER_ID',
  appId: 'VITE_FIREBASE_APP_ID',
  measurementId: 'VITE_FIREBASE_MEASUREMENT_ID',
};

const firebaseFallbackConfig = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: '',
  measurementId: '',
};

const firebaseConfig = Object.fromEntries(
  Object.entries(firebaseEnvMap).map(([key, envKey]) => [key, import.meta.env[envKey] || firebaseFallbackConfig[key]])
);

const requiredFirebaseFields = ['apiKey', 'authDomain', 'projectId', 'appId'];
const missingRequiredFirebaseFields = requiredFirebaseFields.filter((key) => !firebaseConfig[key]);

if (missingRequiredFirebaseFields.length > 0) {
  throw new Error(
    `[firebase] Missing required Firebase config: ${missingRequiredFirebaseFields.join(
      ', '
    )}. Check frontend/.env VITE_FIREBASE_* values.`
  );
}

if (import.meta.env.DEV) {
  const missingFirebaseEnvVars = Object.entries(firebaseEnvMap)
    .filter(([, envKey]) => !import.meta.env[envKey])
    .map(([, envKey]) => envKey);

  if (missingFirebaseEnvVars.length > 0) {
    console.warn(`[firebase] Missing env vars: ${missingFirebaseEnvVars.join(', ')}.`);
  }
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);
let appCheck = null;

if (import.meta.env.PROD) {
  // Keep production console noise low when App Check is throttled by browser privacy policies.
  setLogLevel('error');
}

// Detect emulator mode from environment variable
const useEmulator = import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true';
const appCheckEnabled = import.meta.env.VITE_ENABLE_APPCHECK !== 'false';
const appCheckDebugEnabled = import.meta.env.VITE_APPCHECK_DEBUG === 'true' || import.meta.env.DEV;
const appCheckProviderName = (import.meta.env.VITE_APPCHECK_PROVIDER || 'enterprise').toLowerCase();
const appCheckSiteKey =
  import.meta.env.VITE_APPCHECK_SITE_KEY || import.meta.env.VITE_RECAPTCHA_ENTERPRISE_KEY;
const appCheckProviderMap = {
  enterprise: () => new ReCaptchaEnterpriseProvider(appCheckSiteKey),
  v3: () => new ReCaptchaV3Provider(appCheckSiteKey),
};
const appCheckProviderFactory = appCheckProviderMap[appCheckProviderName];
const appCheckProvider = appCheckSiteKey && appCheckProviderFactory ? appCheckProviderFactory() : null;
const appCheckProviderOff = appCheckProviderName === 'off';
const shouldInitializeAppCheck =
  !useEmulator &&
  appCheckEnabled &&
  !appCheckProviderOff &&
  typeof window !== 'undefined' &&
  appCheckSiteKey &&
  appCheckProvider;

if (shouldInitializeAppCheck) {
  if (appCheckDebugEnabled) {
    window.FIREBASE_APPCHECK_DEBUG_TOKEN = window.FIREBASE_APPCHECK_DEBUG_TOKEN || true;
  }
  appCheck = initializeAppCheck(app, {
    provider: appCheckProvider,
    isTokenAutoRefreshEnabled: true,
  });
} else if (import.meta.env.DEV && !useEmulator) {
  const reason = !appCheckEnabled
    ? 'VITE_ENABLE_APPCHECK=false'
    : appCheckProviderOff
      ? 'VITE_APPCHECK_PROVIDER=off'
      : !appCheckSiteKey
        ? 'missing VITE_APPCHECK_SITE_KEY (or VITE_RECAPTCHA_ENTERPRISE_KEY)'
        : !appCheckProvider
          ? `unsupported VITE_APPCHECK_PROVIDER=${appCheckProviderName}`
          : 'non-browser runtime';
  console.info(`[firebase] App Check not initialized (${reason}).`);
}

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

  connectAuthEmulator(auth, `http://${emulatorHost}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, emulatorHost, 8080);
  connectFunctionsEmulator(functions, emulatorHost, 5001);
  connectStorageEmulator(storage, emulatorHost, 9199);
}

// Intentionally do not expose admin bootstrap callables on window.
// First-admin initialization must be done through secure operational tooling.

// Initialize Analytics (only in browser and not in test mode)
let analytics = null;
if (typeof window !== 'undefined' && !useEmulator) {
  analytics = getAnalytics(app);
}
export { analytics };
export { appCheck };

export default app;
