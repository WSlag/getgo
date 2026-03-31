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
const forceFirestoreLongPolling = import.meta.env.VITE_FIRESTORE_FORCE_LONG_POLLING === 'true';
const autoDetectFirestoreLongPolling = import.meta.env.VITE_FIRESTORE_AUTO_DETECT_LONG_POLLING === 'true';
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
      // Same key in both vars — treat as enterprise only; do NOT try v3 with an enterprise key.
      appCheckCandidates.push({ provider: 'enterprise', siteKey: appCheckSiteKeyEnterprise });
      appCheckResolutionNote =
        'VITE_APPCHECK_SITE_KEY and VITE_RECAPTCHA_ENTERPRISE_KEY are identical. Using enterprise provider only.';
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
    // Only add v3 fallback if a separate, distinct v3 key is configured.
    // Using an Enterprise key with the v3 provider causes a 403 + 24h throttle.
    const hasDistinctV3Key = appCheckSiteKeyV3 && appCheckSiteKeyV3 !== appCheckSiteKeyEnterprise;
    if (hasDistinctV3Key) {
      appCheckCandidates.push({ provider: 'v3', siteKey: appCheckSiteKeyV3 });
      appCheckResolutionNote = 'VITE_APPCHECK_PROVIDER=enterprise configured; distinct v3 fallback enabled if enterprise initialization fails.';
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

// Pre-create a secondary Firebase app for messaging so it is isolated from the default app.
// The Functions client SDK (which uses the default app) calls getImmediate('messaging') in
// getContext() on every callable invocation — if messaging lives on the default app, it
// triggers a spurious FCM token registration that fails with 401.
// By using a separate named app, the Functions SDK cannot discover the messaging instance.
// Created eagerly (before messaging is initialized) so App Check can be started on it in
// initializeAppCheckRuntime(), ensuring tokens are ready before any FCM call.
const messagingFirebaseApp =
  typeof window !== 'undefined' && !useEmulator
    ? getOrInitializeApp(firebaseConfig, 'karga-messaging')
    : app;
export const messagingClientIdentity = `${messagingFirebaseApp.name}:${firebaseConfig.appId}`;

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
        // Mirror App Check onto the messaging app so FCM token requests
        // include proper attestation when the project enforces App Check.
        if (messagingFirebaseApp !== app) {
          try {
            appCheckModule.initializeAppCheck(messagingFirebaseApp, {
              provider: new ProviderCtor(candidate.siteKey),
              isTokenAutoRefreshEnabled: true,
            });
          } catch {
            // Non-fatal — messaging still works; App Check attestation won't be included
          }
        }
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

async function raceWithTimeout(promise, timeoutMs = 0) {
  if (!(timeoutMs > 0)) {
    return promise;
  }

  let timeoutId = null;
  const timeoutPromise = new Promise((resolve) => {
    timeoutId = setTimeout(() => resolve(null), timeoutMs);
  });

  const result = await Promise.race([promise, timeoutPromise]);
  if (timeoutId !== null) {
    clearTimeout(timeoutId);
  }
  return result;
}

export async function hasValidAppCheckToken(timeoutMs = 4000) {
  if (!shouldInitializeAppCheck) {
    return true;
  }

  const initialized = await waitForAppCheckInitialization(timeoutMs).catch(() => false);
  if (!initialized || !appCheck) {
    return false;
  }

  try {
    const appCheckModule = await import('firebase/app-check');
    const tokenResult = await raceWithTimeout(
      appCheckModule.getToken(appCheck, false),
      timeoutMs
    );

    if (!tokenResult) {
      return false;
    }

    return Boolean(tokenResult.token) && !tokenResult.error;
  } catch {
    return false;
  }
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
  const emulatorFirestoreSettings = {
    localCache: memoryLocalCache(),
  };
  if (forceFirestoreLongPolling) {
    emulatorFirestoreSettings.experimentalForceLongPolling = true;
    emulatorFirestoreSettings.useFetchStreams = false;
  } else if (autoDetectFirestoreLongPolling) {
    emulatorFirestoreSettings.experimentalAutoDetectLongPolling = true;
  }

  try {
    // Use memory cache in emulator mode to avoid persistence conflicts
    if (useEmulator) {
      return initializeFirestore(app, emulatorFirestoreSettings);
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

// Initialize FCM Messaging lazily — only when the app explicitly requests push notifications.
// Eager initialization causes the Firebase Functions client SDK to call getToken() on every
// callable function invocation (via getContext → getMessagingToken), which triggers a spurious
// FCM registration request that fails with 401 when App Check is enforced for FCM.
let messaging = null;
let messagingInitPromise = null;

async function initializeMessagingRuntime() {
  if (typeof window === 'undefined' || useEmulator) return null;
  try {
    const { getMessaging } = await import('firebase/messaging');
    // messagingFirebaseApp is a pre-created secondary app (see above). App Check is
    // already initialized on it by initializeAppCheckRuntime(), so FCM token requests
    // will include proper attestation. The Functions SDK uses the default app and cannot
    // discover this messaging instance, preventing spurious FCM registration calls.
    messaging = getMessaging(messagingFirebaseApp);
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('[firebase] FCM Messaging initialization failed:', error?.message || error);
    }
  }
  return messaging;
}

export async function getOrInitMessaging() {
  if (messaging) return messaging;
  if (!messagingInitPromise) {
    messagingInitPromise = initializeMessagingRuntime();
  }
  return messagingInitPromise;
}

export { messaging };

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
