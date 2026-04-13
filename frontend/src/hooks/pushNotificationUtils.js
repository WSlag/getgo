const REGISTERED_KEY_PREFIX = 'karga.push.registered';
const REGISTERED_TOKEN_KEY_PREFIX = 'karga.push.token';
const LEGACY_REGISTERED_KEY = 'karga.push.registered';
const LEGACY_REGISTERED_TOKEN_KEY = 'karga.push.token';
const MESSAGING_IDENTITY_KEY = 'karga.push.messaging.identity';
const UNAUTHORIZED_COOLDOWN_KEY_PREFIX = 'karga.push.cooldown.unauthorized';
const STALE_FULL_RESET_KEY_PREFIX = 'karga.push.recovery.stale-reset';
const VAPID_PROJECT_DEFAULT_PREFERENCE_KEY_PREFIX = 'karga.push.vapid.prefer-default';
const MESSAGING_INDEXED_DB_NAMES = [
  'firebase-messaging-database',
  // Legacy Messaging DBs used by older Firebase Web SDK migrations.
  // If left behind, stale token/VAPID state can be restored after cleanup.
  'fcm_token_details_db',
  'fcm_vapid_details_db',
  'undefined',
];
const INSTALLATIONS_INDEXED_DB_NAMES = ['firebase-installations-database'];

function getSafeStorageValue(storageLike, key) {
  if (!storageLike || !key) return '';
  try {
    return String(storageLike.getItem(key) || '');
  } catch {
    return '';
  }
}

function removeSafeStorageValue(storageLike, key) {
  if (!storageLike || !key) return;
  try {
    storageLike.removeItem(key);
  } catch {
    // Best effort cleanup.
  }
}

function listStorageKeys(storageLike) {
  if (!storageLike) return [];
  try {
    const keys = [];
    for (let index = 0; index < storageLike.length; index += 1) {
      const key = storageLike.key(index);
      if (key) keys.push(String(key));
    }
    return keys;
  } catch {
    return [];
  }
}

function normalizeErrorText(value) {
  return String(value || '').trim().toLowerCase();
}

function truncateText(value, maxLength = 180) {
  const text = String(value || '');
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3)}...`;
}

function decodeBase64UrlSegment(segment) {
  const value = String(segment || '').replace(/-/g, '+').replace(/_/g, '/');
  if (!value) return '';
  const padLength = (4 - (value.length % 4)) % 4;
  const padded = `${value}${'='.repeat(padLength)}`;

  if (typeof atob === 'function') {
    return atob(padded);
  }

  if (typeof Buffer !== 'undefined') {
    return Buffer.from(padded, 'base64').toString('utf8');
  }

  return '';
}

function parseServerResponseStatus(rawServerResponse) {
  const raw = String(rawServerResponse || '').trim();
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    const nestedStatus = Number(parsed?.error?.code);
    if (Number.isFinite(nestedStatus)) return nestedStatus;
  } catch {
    // Fall back to regex extraction from plain text payloads.
  }

  const match = raw.match(/\b(4\d{2}|5\d{2})\b/);
  if (!match) return null;
  const numeric = Number(match[1]);
  return Number.isFinite(numeric) ? numeric : null;
}

async function deleteIndexedDbIfPresent(name) {
  if (!name) return false;
  if (!globalThis?.indexedDB?.deleteDatabase) return false;

  return new Promise((resolve) => {
    try {
      const request = globalThis.indexedDB.deleteDatabase(name);
      request.onsuccess = () => resolve(true);
      request.onerror = () => resolve(false);
      request.onblocked = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

function getRegisteredKey(uid) {
  return `${REGISTERED_KEY_PREFIX}.${uid}`;
}

function getRegisteredTokenKey(uid) {
  return `${REGISTERED_TOKEN_KEY_PREFIX}.${uid}`;
}

export function getStoredRegistration(uid, storageLike = globalThis?.localStorage) {
  if (!uid) return false;
  return getSafeStorageValue(storageLike, getRegisteredKey(uid)) === '1';
}

export function getStoredToken(uid, storageLike = globalThis?.localStorage) {
  if (!uid) return '';
  return getSafeStorageValue(storageLike, getRegisteredTokenKey(uid));
}

export function persistLocalRegistration(uid, token, storageLike = globalThis?.localStorage) {
  if (!uid || !token || !storageLike) return;
  try {
    storageLike.setItem(getRegisteredKey(uid), '1');
    storageLike.setItem(getRegisteredTokenKey(uid), String(token));
  } catch {
    // Storage unavailable; rely on in-memory state.
  }
}

export function clearStoredRegistration(uid, storageLike = globalThis?.localStorage) {
  if (!uid) return;
  removeSafeStorageValue(storageLike, getRegisteredKey(uid));
  removeSafeStorageValue(storageLike, getRegisteredTokenKey(uid));
}

function normalizeToken(value) {
  return String(value || '').trim();
}

export async function reconcileBrowserTokenRegistration({
  storedToken,
  resolveToken,
  hasTokenDocument,
} = {}) {
  let token = normalizeToken(storedToken);
  let tokenSource = token ? 'storage' : 'none';

  if (!token && typeof resolveToken === 'function') {
    try {
      token = normalizeToken(await resolveToken());
      tokenSource = token ? 'messaging' : 'none';
    } catch (error) {
      return {
        checked: true,
        isRegistered: false,
        token: '',
        tokenSource: 'none',
        reason: 'resolve-token-error',
        error,
      };
    }
  }

  if (!token) {
    return {
      checked: true,
      isRegistered: false,
      token: '',
      tokenSource: 'none',
      reason: 'no-token',
    };
  }

  if (typeof hasTokenDocument !== 'function') {
    return {
      checked: true,
      isRegistered: false,
      token,
      tokenSource,
      reason: 'missing-token-check',
    };
  }

  try {
    const hasTokenDoc = await hasTokenDocument(token);
    return {
      checked: true,
      isRegistered: Boolean(hasTokenDoc),
      token,
      tokenSource,
      reason: hasTokenDoc ? 'token-doc-found' : 'token-doc-missing',
    };
  } catch (error) {
    return {
      checked: true,
      isRegistered: false,
      token,
      tokenSource,
      reason: 'verify-token-error',
      error,
    };
  }
}

export function shouldShowPushActivationPending({
  permissionStatus,
  isRegistered,
  isRegistrationStatusChecked,
} = {}) {
  return (
    String(permissionStatus || '') === 'granted'
    && isRegistered !== true
    && isRegistrationStatusChecked === true
  );
}

export async function purgeLocalMessagingRegistrationArtifacts({
  includeInstallations = false,
} = {}) {
  let pushSubscriptionsAttempted = 0;
  let pushSubscriptionsCleared = 0;

  if (
    typeof navigator !== 'undefined'
    && navigator?.serviceWorker
    && typeof navigator.serviceWorker.getRegistrations === 'function'
  ) {
    try {
      let registrations = await navigator.serviceWorker.getRegistrations();
      if ((!registrations || registrations.length === 0) && navigator.serviceWorker.ready) {
        const readyRegistration = await Promise.race([
          navigator.serviceWorker.ready,
          new Promise((resolve) => setTimeout(() => resolve(null), 1500)),
        ]);
        if (readyRegistration) {
          registrations = [readyRegistration];
        }
      }

      for (const registration of registrations || []) {
        if (!registration?.pushManager?.getSubscription) continue;
        pushSubscriptionsAttempted += 1;
        try {
          const subscription = await registration.pushManager.getSubscription();
          if (subscription) {
            const unsubscribed = await subscription.unsubscribe().catch(() => false);
            if (unsubscribed) {
              pushSubscriptionsCleared += 1;
            }
          }
        } catch {
          // Best effort cleanup.
        }
      }
    } catch {
      // Best effort cleanup.
    }
  }

  const dbNames = [
    ...new Set(
      includeInstallations
        ? [...MESSAGING_INDEXED_DB_NAMES, ...INSTALLATIONS_INDEXED_DB_NAMES]
        : [...MESSAGING_INDEXED_DB_NAMES]
    ),
  ];

  const results = await Promise.allSettled(dbNames.map((name) => deleteIndexedDbIfPresent(name)));
  return {
    attempted: dbNames.length,
    deleted: results.filter((entry) => entry.status === 'fulfilled' && entry.value === true).length,
    pushSubscriptionsAttempted,
    pushSubscriptionsCleared,
  };
}

function getStaleFullResetKey(uid) {
  return `${STALE_FULL_RESET_KEY_PREFIX}.${uid}`;
}

export function shouldPurgeInstallationsForStaleCleanup(
  uid,
  sessionStorageLike = globalThis?.sessionStorage
) {
  if (!uid) return true;
  return getSafeStorageValue(sessionStorageLike, getStaleFullResetKey(uid)) !== '1';
}

export function markStaleCleanupInstallationsPurged(
  uid,
  sessionStorageLike = globalThis?.sessionStorage
) {
  if (!uid || !sessionStorageLike) return;
  try {
    sessionStorageLike.setItem(getStaleFullResetKey(uid), '1');
  } catch {
    // Best effort.
  }
}

export function shouldShortCircuitForAppCheck({
  appCheckRequired,
  appCheckReady,
} = {}) {
  return Boolean(appCheckRequired) && !Boolean(appCheckReady);
}

export function migrateLegacyKeysForUid(uid, storageLike = globalThis?.localStorage) {
  if (!uid || !storageLike) return;

  const legacyRegistered = getSafeStorageValue(storageLike, LEGACY_REGISTERED_KEY);
  const legacyToken = getSafeStorageValue(storageLike, LEGACY_REGISTERED_TOKEN_KEY);
  if (legacyRegistered === '1' && legacyToken) {
    persistLocalRegistration(uid, legacyToken, storageLike);
  }

  removeSafeStorageValue(storageLike, LEGACY_REGISTERED_KEY);
  removeSafeStorageValue(storageLike, LEGACY_REGISTERED_TOKEN_KEY);
}

export function ensureMessagingIdentityMigration(
  nextIdentity,
  storageLike = globalThis?.localStorage
) {
  const normalizedNext = String(nextIdentity || '').trim();
  if (!normalizedNext || !storageLike) {
    return { migrated: false, previousIdentity: '', nextIdentity: normalizedNext };
  }

  const previousIdentity = getSafeStorageValue(storageLike, MESSAGING_IDENTITY_KEY);
  if (!previousIdentity || previousIdentity === normalizedNext) {
    try {
      storageLike.setItem(MESSAGING_IDENTITY_KEY, normalizedNext);
    } catch {
      // Best effort persist.
    }
    return { migrated: false, previousIdentity, nextIdentity: normalizedNext };
  }

  const keys = listStorageKeys(storageLike);
  keys.forEach((key) => {
    if (
      key === LEGACY_REGISTERED_KEY ||
      key === LEGACY_REGISTERED_TOKEN_KEY ||
      key.startsWith(`${REGISTERED_KEY_PREFIX}.`) ||
      key.startsWith(`${REGISTERED_TOKEN_KEY_PREFIX}.`)
    ) {
      removeSafeStorageValue(storageLike, key);
    }
  });

  try {
    storageLike.setItem(MESSAGING_IDENTITY_KEY, normalizedNext);
  } catch {
    // Best effort persist.
  }

  return { migrated: true, previousIdentity, nextIdentity: normalizedNext };
}

function inferHttpStatus(rawCode, rawMessage) {
  const code = normalizeErrorText(rawCode);
  const message = normalizeErrorText(rawMessage);

  if (code.includes('401') || message.includes(' 401 ') || message.includes('unauthorized') || message.includes('unauthenticated')) {
    return 401;
  }
  if (code.includes('400') || message.includes(' 400 ') || message.includes('invalid argument') || message.includes('bad request')) {
    return 400;
  }
  if (code.includes('403') || message.includes(' 403 ') || message.includes('permission denied')) {
    return 403;
  }
  return null;
}

export function classifyPushRegistrationError(error) {
  const normalizedCode = normalizeErrorText(error?.code);
  const normalizedMessage = normalizeErrorText(error?.message || error);
  const rawServerResponse = error?.customData?.serverResponse || error?.customData?._serverResponse;
  const serializedRawServerResponse =
    typeof rawServerResponse === 'string'
      ? rawServerResponse
      : rawServerResponse
        ? String(rawServerResponse)
        : '';
  const normalizedServerResponse = normalizeErrorText(
    rawServerResponse
  );
  const searchableMessage = `${normalizedMessage} ${normalizedServerResponse}`.trim();
  const serverStatus = parseServerResponseStatus(rawServerResponse);
  const inferredStatus = inferHttpStatus(normalizedCode, searchableMessage);
  const httpStatus = Number.isFinite(serverStatus) ? serverStatus : inferredStatus;
  const isTokenSubscribeFailure = normalizedCode.includes('token-subscribe-failed');

  const isStaleUnsubscribe =
    searchableMessage.includes('token-unsubscribe-failed') &&
    (httpStatus === 400 || searchableMessage.includes('invalid argument'));

  const isUnauthorized =
    httpStatus === 401 ||
    searchableMessage.includes('missing required authentication credential') ||
    searchableMessage.includes('unauthenticated') ||
    searchableMessage.includes('request had invalid authentication credentials') ||
    searchableMessage.includes('token-subscribe-failed') && searchableMessage.includes('unauthorized') ||
    // Firebase SDK often throws token-subscribe-failed without surfacing the
    // backend 401 payload in .message. Treat it as unauthorized by default so
    // we enter session cooldown instead of retry loops.
    (isTokenSubscribeFailure && !searchableMessage.includes('invalid argument'));

  const isTransient =
    normalizedCode.includes('unavailable') ||
    normalizedCode.includes('deadline-exceeded') ||
    normalizedCode.includes('internal') ||
    normalizedCode.includes('aborted') ||
    searchableMessage.includes('network') ||
    searchableMessage.includes('failed to fetch') ||
    searchableMessage.includes('service worker');

  // Unauthorized must win when both signatures are present in a single payload.
  const category = isUnauthorized
      ? 'unauthorized'
      : isStaleUnsubscribe
        ? 'stale_cleanup'
      : isTransient
        ? 'transient'
        : 'permanent';

  return {
    category,
    normalizedCode,
    normalizedMessage: searchableMessage,
    rawServerResponse: serializedRawServerResponse,
    httpStatus,
    shouldRetry: category === 'transient',
    shouldEnterSessionCooldown: category === 'unauthorized',
  };
}

export function buildPushRegistrationDiagnostics({
  permissionStatus,
  appCheckReady,
  installationsReady,
  swRegistration,
  tokenAcquisitionMode,
  configuredVapidPrefix,
  registrationStage,
  classification,
  recoveryAction = 'none',
  purgedInstallations = false,
  cooldownSet = false,
}) {
  return {
    permissionStatus: String(permissionStatus || 'unknown'),
    appCheckReady: Boolean(appCheckReady),
    installationsReady: Boolean(installationsReady),
    hasServiceWorkerRegistration: Boolean(swRegistration),
    serviceWorkerScope: String(swRegistration?.scope || ''),
    tokenAcquisitionMode: String(tokenAcquisitionMode || ''),
    configuredVapidPrefix: String(configuredVapidPrefix || ''),
    registrationStage: String(registrationStage || ''),
    errorCategory: String(classification?.category || 'unknown'),
    errorCode: String(classification?.normalizedCode || ''),
    httpStatus: classification?.httpStatus ?? null,
    retryable: Boolean(classification?.shouldRetry),
    recoveryAction: String(recoveryAction || 'none'),
    purgedInstallations: Boolean(purgedInstallations),
    cooldownSet: Boolean(cooldownSet),
    rawServerResponse: truncateText(classification?.rawServerResponse || '', 120),
    message: truncateText(classification?.normalizedMessage || ''),
  };
}

function getUnauthorizedCooldownKey(uid) {
  return `${UNAUTHORIZED_COOLDOWN_KEY_PREFIX}.${uid}`;
}

function getProjectDefaultVapidPreferenceKey(uid) {
  return `${VAPID_PROJECT_DEFAULT_PREFERENCE_KEY_PREFIX}.${uid}`;
}

export function isInUnauthorizedSessionCooldown(uid, sessionStorageLike = globalThis?.sessionStorage) {
  if (!uid) return false;
  return getSafeStorageValue(sessionStorageLike, getUnauthorizedCooldownKey(uid)) === '1';
}

export function markUnauthorizedSessionCooldown(uid, sessionStorageLike = globalThis?.sessionStorage) {
  if (!uid || !sessionStorageLike) return;
  try {
    sessionStorageLike.setItem(getUnauthorizedCooldownKey(uid), '1');
  } catch {
    // Best effort.
  }
}

export function clearUnauthorizedSessionCooldown(uid, sessionStorageLike = globalThis?.sessionStorage) {
  if (!uid) return;
  removeSafeStorageValue(sessionStorageLike, getUnauthorizedCooldownKey(uid));
}

export function shouldPreferProjectDefaultVapidForSession(
  uid,
  sessionStorageLike = globalThis?.sessionStorage
) {
  if (!uid) return false;
  return getSafeStorageValue(sessionStorageLike, getProjectDefaultVapidPreferenceKey(uid)) === '1';
}

export function markProjectDefaultVapidPreferredForSession(
  uid,
  sessionStorageLike = globalThis?.sessionStorage
) {
  if (!uid || !sessionStorageLike) return;
  try {
    sessionStorageLike.setItem(getProjectDefaultVapidPreferenceKey(uid), '1');
  } catch {
    // Best effort.
  }
}

export function clearProjectDefaultVapidPreferredForSession(
  uid,
  sessionStorageLike = globalThis?.sessionStorage
) {
  if (!uid) return;
  removeSafeStorageValue(sessionStorageLike, getProjectDefaultVapidPreferenceKey(uid));
}

export async function cleanupPushRegistrationOnLogout({
  uid,
  storedToken,
  deleteStoredTokenDoc,
  clearLocalPushState,
  remoteDeleteToken,
}) {
  if (!uid) return;

  // Explicitly disabled to avoid logout-time FCM unsubscribe churn.
  void remoteDeleteToken;

  if (storedToken) {
    await deleteStoredTokenDoc(storedToken).catch(() => {});
  }
  clearLocalPushState(uid);
}
