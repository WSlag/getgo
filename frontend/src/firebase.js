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
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

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

function extractHost(value) {
  if (!value || typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  try {
    return new URL(trimmed).hostname;
  } catch {
    return trimmed.replace(/^https?:\/\//, '').split('/')[0];
  }
}

function resolveAuthDomain(configuredAuthDomain) {
  if (typeof window === 'undefined' || !import.meta.env.PROD) {
    return configuredAuthDomain;
  }

  const currentHost = extractHost(window.location.hostname);
  const configuredHost = extractHost(configuredAuthDomain);
  const siteHost = extractHost(import.meta.env.VITE_SITE_URL || '');

  if (!currentHost || !configuredHost || currentHost === configuredHost) {
    return configuredAuthDomain;
  }

  const isLocalhost = currentHost === 'localhost' || currentHost === '127.0.0.1';
  if (isLocalhost) {
    return configuredAuthDomain;
  }

  const isFirebaseHostedDomain =
    currentHost.endsWith('.web.app') || currentHost.endsWith('.firebaseapp.com');
  const isConfiguredSiteHost = siteHost && currentHost === siteHost;

  if (isFirebaseHostedDomain || isConfiguredSiteHost) {
    return currentHost;
  }

  return configuredAuthDomain;
}

firebaseConfig.authDomain = resolveAuthDomain(firebaseConfig.authDomain);

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
const configuredAppCheckProvider = (import.meta.env.VITE_APPCHECK_PROVIDER || 'auto').toLowerCase();
const appCheckSiteKeyV3 = import.meta.env.VITE_APPCHECK_SITE_KEY || '';
const appCheckSiteKeyEnterprise = import.meta.env.VITE_RECAPTCHA_ENTERPRISE_KEY || '';
const supportedAppCheckProviders = new Set(['auto', 'enterprise', 'v3', 'off']);
const appCheckProviderName = supportedAppCheckProviders.has(configuredAppCheckProvider)
  ? configuredAppCheckProvider
  : 'auto';

let resolvedAppCheckProvider = appCheckProviderName;
let resolvedAppCheckSiteKey = '';
let appCheckResolutionNote = '';

if (appCheckProviderName === 'auto') {
  if (appCheckSiteKeyEnterprise) {
    resolvedAppCheckProvider = 'enterprise';
    resolvedAppCheckSiteKey = appCheckSiteKeyEnterprise;
  } else if (appCheckSiteKeyV3) {
    resolvedAppCheckProvider = 'v3';
    resolvedAppCheckSiteKey = appCheckSiteKeyV3;
  }
} else if (appCheckProviderName === 'enterprise') {
  if (appCheckSiteKeyEnterprise) {
    resolvedAppCheckSiteKey = appCheckSiteKeyEnterprise;
  } else if (appCheckSiteKeyV3) {
    resolvedAppCheckProvider = 'v3';
    resolvedAppCheckSiteKey = appCheckSiteKeyV3;
    appCheckResolutionNote =
      'VITE_APPCHECK_PROVIDER=enterprise but VITE_RECAPTCHA_ENTERPRISE_KEY is missing. Falling back to v3.';
  }
} else if (appCheckProviderName === 'v3') {
  resolvedAppCheckSiteKey = appCheckSiteKeyV3 || appCheckSiteKeyEnterprise;
  if (!appCheckSiteKeyV3 && appCheckSiteKeyEnterprise) {
    appCheckResolutionNote =
      'Using VITE_RECAPTCHA_ENTERPRISE_KEY as a fallback for v3. Prefer VITE_APPCHECK_SITE_KEY.';
  }
}

if (appCheckResolutionNote) {
  console.warn(`[firebase] ${appCheckResolutionNote}`);
}

const appCheckProviderConstructorNameMap = {
  enterprise: 'ReCaptchaEnterpriseProvider',
  v3: 'ReCaptchaV3Provider',
};
const appCheckProviderConstructorName = appCheckProviderConstructorNameMap[resolvedAppCheckProvider];
const appCheckProviderConfigured = Boolean(resolvedAppCheckSiteKey && appCheckProviderConstructorName);
const appCheckProviderOff = appCheckProviderName === 'off';
const shouldInitializeAppCheck =
  !useEmulator &&
  appCheckEnabled &&
  !appCheckProviderOff &&
  typeof window !== 'undefined' &&
  appCheckProviderConfigured;

async function initializeAppCheckRuntime() {
  try {
    const appCheckModule = await import('firebase/app-check');
    const ProviderCtor = appCheckModule[appCheckProviderConstructorName];

    if (!ProviderCtor) {
      if (import.meta.env.DEV) {
        console.warn(
          `[firebase] App Check provider constructor missing for ${resolvedAppCheckProvider}.`
        );
      }
      return;
    }

    if (appCheckDebugEnabled) {
      window.FIREBASE_APPCHECK_DEBUG_TOKEN = window.FIREBASE_APPCHECK_DEBUG_TOKEN || true;
    }

    appCheck = appCheckModule.initializeAppCheck(app, {
      provider: new ProviderCtor(resolvedAppCheckSiteKey),
      isTokenAutoRefreshEnabled: true,
    });
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('[firebase] App Check initialization failed:', error?.message || error);
    }
  }
}

if (shouldInitializeAppCheck) {
  void initializeAppCheckRuntime();
} else if (import.meta.env.DEV && !useEmulator) {
  const reason = !appCheckEnabled
    ? 'VITE_ENABLE_APPCHECK=false'
    : appCheckProviderOff
      ? 'VITE_APPCHECK_PROVIDER=off'
      : !resolvedAppCheckSiteKey
        ? 'missing App Check site key (VITE_APPCHECK_SITE_KEY or VITE_RECAPTCHA_ENTERPRISE_KEY)'
        : !appCheckProviderConfigured
          ? `unsupported VITE_APPCHECK_PROVIDER=${appCheckProviderName} (resolved=${resolvedAppCheckProvider})`
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
async function initializeAnalyticsRuntime() {
  try {
    const analyticsModule = await import('firebase/analytics');
    analytics = analyticsModule.getAnalytics(app);
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('[firebase] Analytics initialization failed:', error?.message || error);
    }
  }
}

if (typeof window !== 'undefined' && !useEmulator) {
  void initializeAnalyticsRuntime();
}
export { analytics };
export { appCheck };

export default app;
