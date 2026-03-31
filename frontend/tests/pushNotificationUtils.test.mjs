import test from 'node:test';
import assert from 'node:assert/strict';

import {
  classifyPushRegistrationError,
  cleanupPushRegistrationOnLogout,
  purgeLocalMessagingRegistrationArtifacts,
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
    assert.equal(result.attempted, 2);
    assert.equal(result.deleted, 2);
  } finally {
    if (typeof previousIndexedDb === 'undefined') {
      delete globalThis.indexedDB;
    } else {
      globalThis.indexedDB = previousIndexedDb;
    }
  }
});
