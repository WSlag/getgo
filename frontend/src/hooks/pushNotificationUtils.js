const REGISTERED_KEY_PREFIX = 'karga.push.registered';
const REGISTERED_TOKEN_KEY_PREFIX = 'karga.push.token';
const LEGACY_REGISTERED_KEY = 'karga.push.registered';
const LEGACY_REGISTERED_TOKEN_KEY = 'karga.push.token';
const MESSAGING_IDENTITY_KEY = 'karga.push.messaging.identity';
const UNAUTHORIZED_COOLDOWN_KEY_PREFIX = 'karga.push.cooldown.unauthorized';
const MESSAGING_INDEXED_DB_NAMES = ['firebase-messaging-database'];
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

export async function purgeLocalMessagingRegistrationArtifacts({
  includeInstallations = false,
} = {}) {
  const dbNames = includeInstallations
    ? [...MESSAGING_INDEXED_DB_NAMES, ...INSTALLATIONS_INDEXED_DB_NAMES]
    : [...MESSAGING_INDEXED_DB_NAMES];

  const results = await Promise.allSettled(dbNames.map((name) => deleteIndexedDbIfPresent(name)));
  return {
    attempted: dbNames.length,
    deleted: results.filter((entry) => entry.status === 'fulfilled' && entry.value === true).length,
  };
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
  const normalizedServerResponse = normalizeErrorText(
    error?.customData?.serverResponse || error?.customData?._serverResponse
  );
  const searchableMessage = `${normalizedMessage} ${normalizedServerResponse}`.trim();
  const httpStatus = inferHttpStatus(normalizedCode, searchableMessage);

  const isStaleUnsubscribe =
    searchableMessage.includes('token-unsubscribe-failed') &&
    (httpStatus === 400 || searchableMessage.includes('invalid argument'));

  const isUnauthorized =
    httpStatus === 401 ||
    searchableMessage.includes('missing required authentication credential') ||
    searchableMessage.includes('unauthenticated') ||
    searchableMessage.includes('request had invalid authentication credentials') ||
    searchableMessage.includes('token-subscribe-failed') && searchableMessage.includes('unauthorized');

  const isTransient =
    normalizedCode.includes('unavailable') ||
    normalizedCode.includes('deadline-exceeded') ||
    normalizedCode.includes('internal') ||
    normalizedCode.includes('aborted') ||
    searchableMessage.includes('network') ||
    searchableMessage.includes('failed to fetch') ||
    searchableMessage.includes('service worker');

  const category = isStaleUnsubscribe
    ? 'stale_cleanup'
    : isUnauthorized
      ? 'unauthorized'
      : isTransient
        ? 'transient'
        : 'permanent';

  return {
    category,
    normalizedCode,
    normalizedMessage: searchableMessage,
    httpStatus,
    shouldRetry: category === 'transient',
    shouldEnterSessionCooldown: category === 'unauthorized',
  };
}

export function buildPushRegistrationDiagnostics({
  permissionStatus,
  appCheckReady,
  swRegistration,
  classification,
}) {
  return {
    permissionStatus: String(permissionStatus || 'unknown'),
    appCheckReady: Boolean(appCheckReady),
    hasServiceWorkerRegistration: Boolean(swRegistration),
    serviceWorkerScope: String(swRegistration?.scope || ''),
    errorCategory: String(classification?.category || 'unknown'),
    errorCode: String(classification?.normalizedCode || ''),
    httpStatus: classification?.httpStatus ?? null,
    retryable: Boolean(classification?.shouldRetry),
    message: truncateText(classification?.normalizedMessage || ''),
  };
}

function getUnauthorizedCooldownKey(uid) {
  return `${UNAUTHORIZED_COOLDOWN_KEY_PREFIX}.${uid}`;
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
