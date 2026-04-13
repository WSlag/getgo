import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildPushRegistrationDiagnostics,
  classifyPushRegistrationError,
  clearProjectDefaultVapidPreferredForSession,
  cleanupPushRegistrationOnLogout,
  markProjectDefaultVapidPreferredForSession,
  markStaleCleanupInstallationsPurged,
  purgeLocalMessagingRegistrationArtifacts,
  reconcileBrowserTokenRegistration,
  shouldPreferProjectDefaultVapidForSession,
  shouldPurgeInstallationsForStaleCleanup,
  shouldShortCircuitForAppCheck,
  shouldShowPushActivationPending,
} from '../src/hooks/pushNotificationUtils.js';

test('classifyPushRegistrationError marks token-unsubscribe 400 as stale cleanup', () => {
  const error = new Error(
    'Messaging: A problem occurred while unsubscribing the user from FCM: Request contains an invalid argument. (messaging/token-unsubscribe-failed).'
  );

  const classified = classifyPushRegistrationError(error);
  assert.equal(classified.category, 'stale_cleanup');
  assert.equal(classified.httpStatus, 400);
  assert.equal(classified.shouldRetry, false);
  assert.equal(classified.shouldEnterSessionCooldown, false);
});

test('classifyPushRegistrationError marks unauthorized 401 as session cooldown', () => {
  const error = new Error(
    'Messaging: token-subscribe-failed: POST /registrations 401 Unauthorized'
  );

  const classified = classifyPushRegistrationError(error);
  assert.equal(classified.category, 'unauthorized');
  assert.equal(classified.httpStatus, 401);
  assert.equal(classified.shouldRetry, false);
  assert.equal(classified.shouldEnterSessionCooldown, true);
});

test('classifyPushRegistrationError treats bare token-subscribe-failed as unauthorized fallback', () => {
  const error = {
    code: 'messaging/token-subscribe-failed',
    message: 'Messaging: token-subscribe-failed.',
  };

  const classified = classifyPushRegistrationError(error);
  assert.equal(classified.category, 'unauthorized');
  assert.equal(classified.shouldRetry, false);
  assert.equal(classified.shouldEnterSessionCooldown, true);
});

test('classifyPushRegistrationError reads unauthorized from customData.serverResponse', () => {
  const error = {
    code: 'messaging/token-subscribe-failed',
    message: 'Messaging: token-subscribe-failed.',
    customData: {
      serverResponse: '{"error":{"code":401,"status":"UNAUTHENTICATED"}}',
    },
  };

  const classified = classifyPushRegistrationError(error);
  assert.equal(classified.category, 'unauthorized');
  assert.equal(classified.httpStatus, 401);
  assert.equal(classified.shouldRetry, false);
  assert.equal(classified.shouldEnterSessionCooldown, true);
});

test('classifyPushRegistrationError prioritizes unauthorized over stale cleanup when both signatures exist', () => {
  const error = {
    code: 'messaging/token-unsubscribe-failed',
    message: 'Messaging: token-unsubscribe-failed. Request contains an invalid argument.',
    customData: {
      serverResponse: '{"error":{"code":401,"status":"UNAUTHENTICATED"}}',
    },
  };

  const classified = classifyPushRegistrationError(error);
  assert.equal(classified.category, 'unauthorized');
  assert.equal(classified.httpStatus, 401);
  assert.equal(classified.shouldEnterSessionCooldown, true);
});

test('classifyPushRegistrationError marks network failures retryable', () => {
  const error = new Error('Messaging: network request failed while subscribing');

  const classified = classifyPushRegistrationError(error);
  assert.equal(classified.category, 'transient');
  assert.equal(classified.shouldRetry, true);
  assert.equal(classified.shouldEnterSessionCooldown, false);
});

test('cleanupPushRegistrationOnLogout skips remote deleteToken and performs local cleanup', async () => {
  let deleteTokenDocCalls = 0;
  let clearLocalCalls = 0;
  let remoteDeleteCalls = 0;

  await cleanupPushRegistrationOnLogout({
    uid: 'user-1',
    storedToken: 'token-1',
    deleteStoredTokenDoc: async () => {
      deleteTokenDocCalls += 1;
    },
    clearLocalPushState: () => {
      clearLocalCalls += 1;
    },
    remoteDeleteToken: async () => {
      remoteDeleteCalls += 1;
    },
  });

  assert.equal(deleteTokenDocCalls, 1);
  assert.equal(clearLocalCalls, 1);
  assert.equal(remoteDeleteCalls, 0);
});

test('purgeLocalMessagingRegistrationArtifacts attempts indexeddb cleanup', async () => {
  const previousIndexedDb = globalThis.indexedDB;
  try {
    globalThis.indexedDB = {
      deleteDatabase: () => {
        const request = {};
        queueMicrotask(() => {
          if (typeof request.onsuccess === 'function') {
            request.onsuccess();
          }
        });
        return request;
      },
    };

    const result = await purgeLocalMessagingRegistrationArtifacts({ includeInstallations: true });
    assert.equal(result.attempted, 5);
    assert.equal(result.deleted, 5);
  } finally {
    if (typeof previousIndexedDb === 'undefined') {
      delete globalThis.indexedDB;
    } else {
      globalThis.indexedDB = previousIndexedDb;
    }
  }
});

test('stale cleanup installations purge is guarded to once per session', () => {
  const storage = {
    map: new Map(),
    getItem(key) {
      return this.map.has(key) ? this.map.get(key) : null;
    },
    setItem(key, value) {
      this.map.set(key, String(value));
    },
    removeItem(key) {
      this.map.delete(key);
    },
  };

  assert.equal(shouldPurgeInstallationsForStaleCleanup('user-1', storage), true);
  markStaleCleanupInstallationsPurged('user-1', storage);
  assert.equal(shouldPurgeInstallationsForStaleCleanup('user-1', storage), false);
  assert.equal(shouldPurgeInstallationsForStaleCleanup('user-2', storage), true);
});

test('project-default vapid session preference is scoped per user and clearable', () => {
  const storage = {
    map: new Map(),
    getItem(key) {
      return this.map.has(key) ? this.map.get(key) : null;
    },
    setItem(key, value) {
      this.map.set(key, String(value));
    },
    removeItem(key) {
      this.map.delete(key);
    },
  };

  assert.equal(shouldPreferProjectDefaultVapidForSession('user-1', storage), false);
  markProjectDefaultVapidPreferredForSession('user-1', storage);
  assert.equal(shouldPreferProjectDefaultVapidForSession('user-1', storage), true);
  assert.equal(shouldPreferProjectDefaultVapidForSession('user-2', storage), false);

  clearProjectDefaultVapidPreferredForSession('user-1', storage);
  assert.equal(shouldPreferProjectDefaultVapidForSession('user-1', storage), false);
});

test('shouldShortCircuitForAppCheck only triggers when app check is required but not ready', () => {
  assert.equal(
    shouldShortCircuitForAppCheck({ appCheckRequired: true, appCheckReady: false }),
    true
  );
  assert.equal(
    shouldShortCircuitForAppCheck({ appCheckRequired: true, appCheckReady: true }),
    false
  );
  assert.equal(
    shouldShortCircuitForAppCheck({ appCheckRequired: false, appCheckReady: false }),
    false
  );
});

test('buildPushRegistrationDiagnostics includes recovery action telemetry fields', () => {
  const diagnostics = buildPushRegistrationDiagnostics({
    permissionStatus: 'granted',
    appCheckReady: false,
    swRegistration: { scope: 'https://getgoph.com/' },
    classification: {
      category: 'unauthorized',
      normalizedCode: 'messaging/token-subscribe-failed',
      normalizedMessage: 'token-subscribe-failed 401 unauthorized',
      httpStatus: 401,
      shouldRetry: false,
    },
    recoveryAction: 'unauthorized_session_cooldown',
    purgedInstallations: true,
    cooldownSet: true,
  });

  assert.equal(diagnostics.recoveryAction, 'unauthorized_session_cooldown');
  assert.equal(diagnostics.purgedInstallations, true);
  assert.equal(diagnostics.cooldownSet, true);
});

test('reconcileBrowserTokenRegistration confirms active token when token document exists', async () => {
  const result = await reconcileBrowserTokenRegistration({
    storedToken: 'token-active',
    hasTokenDocument: async (token) => token === 'token-active',
  });

  assert.equal(result.isRegistered, true);
  assert.equal(result.token, 'token-active');
  assert.equal(result.reason, 'token-doc-found');
  assert.equal(result.tokenSource, 'storage');
});

test('reconcileBrowserTokenRegistration stays unregistered when token document is missing', async () => {
  const result = await reconcileBrowserTokenRegistration({
    storedToken: '',
    resolveToken: async () => 'token-missing',
    hasTokenDocument: async () => false,
  });

  assert.equal(result.isRegistered, false);
  assert.equal(result.token, 'token-missing');
  assert.equal(result.reason, 'token-doc-missing');
  assert.equal(result.tokenSource, 'messaging');
});

test('reconcileBrowserTokenRegistration never marks active on token verification failure', async () => {
  const result = await reconcileBrowserTokenRegistration({
    storedToken: 'token-failing',
    hasTokenDocument: async () => {
      throw new Error('verification-failed');
    },
  });

  assert.equal(result.isRegistered, false);
  assert.equal(result.reason, 'verify-token-error');
  assert.equal(result.token, 'token-failing');
});

test('shouldShowPushActivationPending hides card while registration check is pending', () => {
  const result = shouldShowPushActivationPending({
    permissionStatus: 'granted',
    isRegistered: false,
    isRegistrationStatusChecked: false,
  });

  assert.equal(result, false);
});

test('shouldShowPushActivationPending shows card only for granted + unchecked registration false', () => {
  const visible = shouldShowPushActivationPending({
    permissionStatus: 'granted',
    isRegistered: false,
    isRegistrationStatusChecked: true,
  });
  const hiddenWhenRegistered = shouldShowPushActivationPending({
    permissionStatus: 'granted',
    isRegistered: true,
    isRegistrationStatusChecked: true,
  });

  assert.equal(visible, true);
  assert.equal(hiddenWhenRegistered, false);
});
