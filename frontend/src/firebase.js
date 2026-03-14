import { getApps, initializeApp, setLogLevel } from 'firebase/app';
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

function parseHostAllowlist(rawValue) {
  if (!rawValue || typeof rawValue !== 'string') return [];
  return rawValue
    .split(',')
    .map((entry) => extractHost(entry).toLowerCase())
    .filter(Boolean);
}

function isProjectHostedDomain(host, projectId) {
  if (!host || !projectId) return false;
  const normalizedHost = String(host).trim().toLowerCase();
  const normalizedProjectId = String(projectId).trim().toLowerCase();
  if (!normalizedHost || !normalizedProjectId) return false;
  return (
    normalizedHost === `${normalizedProjectId}.web.app`
    || normalizedHost === `${normalizedProjectId}.firebaseapp.com`
  );
}

function resolveAuthDomain(configuredAuthDomain) {
  // Keep authDomain stable by default.
  // Set VITE_USE_RUNTIME_AUTH_DOMAIN=true to opt in to host-based authDomain overrides.
  const allowRuntimeAuthDomain = import.meta.env.VITE_USE_RUNTIME_AUTH_DOMAIN === 'true';
  if (typeof window === 'undefined' || !import.meta.env.PROD || !allowRuntimeAuthDomain) {
    return configuredAuthDomain;
  }

  const currentHost = extractHost(window.location.hostname);
  const configuredHost = extractHost(configuredAuthDomain);
  const currentHostLower = currentHost.toLowerCase();
  const allowlistedHosts = parseHostAllowlist(import.meta.env.VITE_RUNTIME_AUTH_DOMAIN_ALLOWLIST || '');
  const allowlistedSet = new Set(allowlistedHosts);
  const canUseCurrentHostAsAuthDomain =
    isProjectHostedDomain(currentHostLower, firebaseConfig.projectId)
    || allowlistedSet.has(currentHostLower);

  if (!currentHost || !configuredHost || currentHost === configuredHost) {
    return configuredAuthDomain;
  }

  const isLocalhost = currentHost === 'localhost' || currentHost === '127.0.0.1';
  if (isLocalhost) {
    return configuredAuthDomain;
  }

  if (canUseCurrentHostAsAuthDomain) {
    return currentHost;
  }

  if (import.meta.env.DEV) {
    console.warn(
      `[firebase] Skipping runtime authDomain override for ${currentHost}; host is not allow-listed for project ${firebaseConfig.projectId}.`
    );
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

function getOrInitializeApp(config, name) {
  const existingApp = getApps().find((candidate) => candidate.name === name);
  return existingApp || initializeApp(config, name);
}

// Initialize Firebase
const app = getOrInitializeApp(firebaseConfig, '[DEFAULT]');
let appCheck = null;
let appCheckInitializationPromise = null;

if (import.meta.env.PROD) {
  // Keep production console noise low when App Check is throttled by browser privacy policies.
  setLogLevel('error');
}

// Detect emulator mode from environment variable
const useEmulator = import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true';
const appCheckEnabled = import.meta.env.VITE_ENABLE_APPCHECK !== 'false';
const appCheckDebugEnabled = import.meta.env.VITE_APPCHECK_DEBUG === 'true' || import.meta.env.DEV;
const configuredAppCheckProvider = (import.meta.env.VITE_APPCHECK_PROVIDER || 'auto').toLowerCase();
const appCheckSiteKeyV3 = (import.meta.env.VITE_APPCHECK_SITE_KEY || '').trim();
const appCheckSiteKeyEnterprise = (import.meta.env.VITE_RECAPTCHA_ENTERPRISE_KEY || '').trim();
const supportedAppCheckProviders = new Set(['auto', 'enterprise', 'v3', 'off']);
const appCheckProviderName = supportedAppCheckProviders.has(configuredAppCheckProvider)
  ? configuredAppCheckProvider
  : 'auto';

const appCheckCandidates = [];
let appCheckResolutionNote = '';

if (appCheckProviderName === 'auto') {
  if (appCheckSiteKeyEnterprise && appCheckSiteKeyV3) {
    if (appCheckSiteKeyEnterprise === appCheckSiteKeyV3) {
      // Shared legacy key values are ambiguous; prefer v3 first and fallback to enterprise.
      appCheckCandidates.push(
        { provider: 'v3', siteKey: appCheckSiteKeyV3 },
        { provider: 'enterprise', siteKey: appCheckSiteKeyEnterprise }
      );
      appCheckResolutionNote =
        'VITE_APPCHECK_SITE_KEY and VITE_RECAPTCHA_ENTERPRISE_KEY are identical. Trying v3 first, then enterprise.';
    } else {
      appCheckCandidates.push(
        { provider: 'enterprise', siteKey: appCheckSiteKeyEnterprise },
        { provider: 'v3', siteKey: appCheckSiteKeyV3 }
      );
    }
  } else if (appCheckSiteKeyEnterprise) {
    appCheckCandidates.push({ provider: 'enterprise', siteKey: appCheckSiteKeyEnterprise });
  } else if (appCheckSiteKeyV3) {
    appCheckCandidates.push({ provider: 'v3', siteKey: appCheckSiteKeyV3 });
  }
} else if (appCheckProviderName === 'enterprise') {
  if (appCheckSiteKeyEnterprise) {
    appCheckCandidates.push({ provider: 'enterprise', siteKey: appCheckSiteKeyEnterprise });
    const v3FallbackKey = appCheckSiteKeyV3 || appCheckSiteKeyEnterprise;
    if (v3FallbackKey) {
      appCheckCandidates.push({ provider: 'v3', siteKey: v3FallbackKey });
      appCheckResolutionNote = appCheckSiteKeyV3
        ? 'VITE_APPCHECK_PROVIDER=enterprise configured; v3 fallback enabled if enterprise initialization fails.'
        : 'VITE_APPCHECK_PROVIDER=enterprise configured with only enterprise key; v3 fallback enabled as a resilience path.';
    }
  } else if (appCheckSiteKeyV3) {
    appCheckCandidates.push({ provider: 'v3', siteKey: appCheckSiteKeyV3 });
    appCheckResolutionNote =
      'VITE_APPCHECK_PROVIDER=enterprise but VITE_RECAPTCHA_ENTERPRISE_KEY is missing. Falling back to v3.';
  }
} else if (appCheckProviderName === 'v3') {
  const v3SiteKey = appCheckSiteKeyV3 || appCheckSiteKeyEnterprise;
  if (v3SiteKey) {
    appCheckCandidates.push({ provider: 'v3', siteKey: v3SiteKey });
  }
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
const resolvedAppCheckProvider = appCheckCandidates[0]?.provider || appCheckProviderName;
const resolvedAppCheckSiteKey = appCheckCandidates[0]?.siteKey || '';
const appCheckProviderConfigured = appCheckCandidates.length > 0;
const appCheckProviderOff = appCheckProviderName === 'off';
const currentRuntimeHost =
  typeof window !== 'undefined' ? extractHost(window.location.hostname) : '';
const isLocalRuntimeHost =
  currentRuntimeHost === 'localhost' || currentRuntimeHost === '127.0.0.1';
const appCheckAllowedOnLocalhost = import.meta.env.VITE_ENABLE_APPCHECK_ON_LOCALHOST === 'true';
const appCheckDisabledForLocalhost = isLocalRuntimeHost && !appCheckAllowedOnLocalhost;
export const shouldInitializeAppCheck =
  !useEmulator &&
  appCheckEnabled &&
  !appCheckProviderOff &&
  !appCheckDisabledForLocalhost &&
  typeof window !== 'undefined' &&
  appCheckProviderConfigured;

async function initializeAppCheckRuntime() {
  try {
    const appCheckModule = await import('firebase/app-check');

    if (appCheckDebugEnabled) {
      window.FIREBASE_APPCHECK_DEBUG_TOKEN = window.FIREBASE_APPCHECK_DEBUG_TOKEN || true;
    }

    // App Check must be initialized on the default app so Firebase Auth
    // can attach X-Firebase-AppCheck headers to Identity Toolkit requests.
    const appCheckRuntimeApp = app;
    for (let index = 0; index < appCheckCandidates.length; index += 1) {
      const candidate = appCheckCandidates[index];
      const constructorName = appCheckProviderConstructorNameMap[candidate.provider];
      const ProviderCtor = appCheckModule[constructorName];

      if (!ProviderCtor) {
        if (import.meta.env.DEV) {
          console.warn(`[firebase] App Check provider constructor missing for ${candidate.provider}.`);
        }
        continue;
      }

      try {
        appCheck = appCheckModule.initializeAppCheck(appCheckRuntimeApp, {
          provider: new ProviderCtor(candidate.siteKey),
          isTokenAutoRefreshEnabled: true,
        });
        return true;
      } catch (error) {
        const hasFallback = index < appCheckCandidates.length - 1;
        if (import.meta.env.DEV && hasFallback) {
          const message = error?.message || error;
          console.warn(
            `[firebase] App Check init failed for ${candidate.provider}. Retrying fallback provider.`,
            message
          );
        } else if (import.meta.env.DEV) {
          console.warn(
            `[firebase] App Check init failed for ${candidate.provider}.`,
            error?.message || error
          );
        }
      }
    }

    return false;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('[firebase] App Check initialization failed:', error?.message || error);
    }
    return false;
  }
}

function startAppCheckInitialization() {
  if (!appCheckInitializationPromise) {
    appCheckInitializationPromise = initializeAppCheckRuntime().catch(() => false);
  }
  return appCheckInitializationPromise;
}

export async function waitForAppCheckInitialization(timeoutMs = 4000) {
  if (!shouldInitializeAppCheck) {
    return false;
  }

  const initializationPromise = startAppCheckInitialization();
  if (!(timeoutMs > 0)) {
    await initializationPromise;
    return Boolean(appCheck);
  }

  let timeoutId = null;
  await Promise.race([
    initializationPromise,
    new Promise((resolve) => {
      timeoutId = setTimeout(resolve, timeoutMs);
    }),
  ]);

  if (timeoutId !== null) {
    clearTimeout(timeoutId);
  }

  return Boolean(appCheck);
}

if (shouldInitializeAppCheck) {
  void startAppCheckInitialization();
} else if (import.meta.env.DEV && !useEmulator) {
  const reason = !appCheckEnabled
    ? 'VITE_ENABLE_APPCHECK=false'
    : appCheckProviderOff
      ? 'VITE_APPCHECK_PROVIDER=off'
      : appCheckDisabledForLocalhost
        ? 'localhost runtime (set VITE_ENABLE_APPCHECK_ON_LOCALHOST=true to override)'
      : !resolvedAppCheckSiteKey
        ? 'missing App Check site key (VITE_APPCHECK_SITE_KEY or VITE_RECAPTCHA_ENTERPRISE_KEY)'
        : !appCheckProviderConfigured
          ? `unsupported VITE_APPCHECK_PROVIDER=${appCheckProviderName} (resolved=${resolvedAppCheckProvider})`
          : 'non-browser runtime';
  console.info(`[firebase] App Check not initialized (${reason}).`);
}

// Initialize services
export const auth = getAuth(app);
const disableAuthAppVerificationForTesting = useEmulator;
if (disableAuthAppVerificationForTesting) {
  auth.settings.appVerificationDisabledForTesting = true;
}
export const isAuthAppVerificationBypassed = disableAuthAppVerificationForTesting;
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
    if (import.meta.env.DEV) console.warn('Firestore persistent cache unavailable, using memory cache:', err?.message || err);
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
