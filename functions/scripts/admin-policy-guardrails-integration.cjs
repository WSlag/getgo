#!/usr/bin/env node

const admin = require('firebase-admin');
const axios = require('axios');

const PROJECT_ID = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || 'karga-ph';
const EMULATOR_HOSTS = {
  auth: process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099',
  firestore: process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080',
};

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertIncludes(haystack, needle, label) {
  const left = String(haystack || '').toLowerCase();
  const right = String(needle || '').toLowerCase();
  assert(left.includes(right), `${label}: expected "${needle}" in "${haystack}"`);
}

async function expectHttpsError(callable, expectedCode, expectedMessage, label) {
  try {
    await callable();
  } catch (error) {
    const code = String(error?.code || '');
    const message = String(error?.message || '');
    assert(code === expectedCode, `${label}: expected code "${expectedCode}", received "${code}"`);
    assertIncludes(message, expectedMessage, label);
    return;
  }
  throw new Error(`${label}: expected callable to fail`);
}

async function clearEmulators() {
  await axios.delete(`http://${EMULATOR_HOSTS.auth}/emulator/v1/projects/${PROJECT_ID}/accounts`);
  await axios.delete(`http://${EMULATOR_HOSTS.firestore}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`);
}

async function seedAuthUser(uid, displayName) {
  await admin.auth().createUser({ uid, displayName });
}

async function seedUserDoc(uid, data = {}) {
  const now = admin.firestore.FieldValue.serverTimestamp();
  const role = String(data.role || '').trim().toLowerCase() || 'shipper';
  await admin.firestore().collection('users').doc(uid).set({
    name: data.name || uid,
    role,
    isAdmin: data.isAdmin === true,
    isActive: data.isActive !== false,
    isVerified: data.isVerified === true,
    accountStatus: data.isActive === false ? 'suspended' : 'active',
    previousNonAdminRole: data.previousNonAdminRole || (role === 'admin' ? 'shipper' : role),
    createdAt: now,
    updatedAt: now,
  }, { merge: true });
}

async function main() {
  process.env.FIREBASE_AUTH_EMULATOR_HOST = EMULATOR_HOSTS.auth;
  process.env.FIRESTORE_EMULATOR_HOST = EMULATOR_HOSTS.firestore;
  process.env.ALLOW_ADMIN_GRANTS = 'false';

  console.log('Clearing emulator state...');
  await clearEmulators();

  // Loads all callable exports and initializes firebase-admin app once.
  const exportedFunctions = require('../index');

  const primaryAdminUid = 'admin-policy-primary';
  const secondaryAdminUid = 'admin-policy-secondary';
  const targetUserUid = 'admin-policy-target';

  console.log('Seeding baseline users...');
  await seedAuthUser(primaryAdminUid, 'Primary Admin');
  await seedAuthUser(targetUserUid, 'Target User');
  await seedUserDoc(primaryAdminUid, {
    name: 'Primary Admin',
    role: 'admin',
    isAdmin: true,
    previousNonAdminRole: 'shipper',
  });
  await seedUserDoc(targetUserUid, {
    name: 'Target User',
    role: 'shipper',
    isAdmin: false,
  });

  const adminContextV1 = {
    auth: { uid: primaryAdminUid, token: { admin: true } },
    app: { appId: 'admin-policy-test' },
    rawRequest: { ip: '127.0.0.1', headers: { 'user-agent': 'admin-policy-test' } },
  };
  const adminRequestV2 = {
    auth: { uid: primaryAdminUid, token: { admin: true } },
    app: { appId: 'admin-policy-test' },
  };

  console.log('Asserting no additional admin grant via adminToggleAdmin...');
  await expectHttpsError(
    () => exportedFunctions.adminToggleAdmin.run({ userId: targetUserUid, grant: true }, adminContextV1),
    'failed-precondition',
    'Granting new admins is currently disabled',
    'adminToggleAdmin grant lock'
  );

  console.log('Asserting no additional admin grant via setAdminRole...');
  await expectHttpsError(
    () => exportedFunctions.setAdminRole.run({
      data: { targetUserId: targetUserUid, isAdmin: true },
      ...adminRequestV2,
    }),
    'failed-precondition',
    'Granting new admins is currently disabled',
    'setAdminRole grant lock'
  );

  console.log('Asserting last-admin revoke is blocked via adminToggleAdmin...');
  await expectHttpsError(
    () => exportedFunctions.adminToggleAdmin.run({ userId: primaryAdminUid, grant: false }, adminContextV1),
    'failed-precondition',
    'Cannot revoke the last active admin',
    'adminToggleAdmin last-admin protection'
  );

  console.log('Asserting last-admin revoke is blocked via setAdminRole...');
  await expectHttpsError(
    () => exportedFunctions.setAdminRole.run({
      data: { targetUserId: primaryAdminUid, isAdmin: false },
      ...adminRequestV2,
    }),
    'failed-precondition',
    'Cannot revoke the last active admin',
    'setAdminRole last-admin protection'
  );

  console.log('Seeding second admin to validate existing admin operations still work...');
  await seedAuthUser(secondaryAdminUid, 'Secondary Admin');
  await seedUserDoc(secondaryAdminUid, {
    name: 'Secondary Admin',
    role: 'admin',
    isAdmin: true,
    previousNonAdminRole: 'trucker',
  });

  const revokeViaToggle = await exportedFunctions.adminToggleAdmin.run(
    { userId: secondaryAdminUid, grant: false },
    adminContextV1
  );
  assertIncludes(
    revokeViaToggle?.message || '',
    'revoked',
    'adminToggleAdmin revoke should succeed when two admins exist'
  );
  const afterToggle = (await admin.firestore().collection('users').doc(secondaryAdminUid).get()).data() || {};
  assert(afterToggle.isAdmin === false, 'secondary admin should be revoked via adminToggleAdmin');

  await admin.firestore().collection('users').doc(secondaryAdminUid).set({
    role: 'admin',
    isAdmin: true,
    previousNonAdminRole: 'trucker',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  const revokeViaLegacy = await exportedFunctions.setAdminRole.run({
    data: { targetUserId: secondaryAdminUid, isAdmin: false },
    ...adminRequestV2,
  });
  assert(revokeViaLegacy?.success === true, 'setAdminRole revoke should succeed when two admins exist');
  const afterLegacy = (await admin.firestore().collection('users').doc(secondaryAdminUid).get()).data() || {};
  assert(afterLegacy.isAdmin === false, 'secondary admin should be revoked via setAdminRole');

  const primaryAfter = (await admin.firestore().collection('users').doc(primaryAdminUid).get()).data() || {};
  assert(primaryAfter.isAdmin === true || primaryAfter.role === 'admin', 'existing primary admin must remain active');

  console.log('PASS admin policy guardrails integration test');
}

main().catch((error) => {
  console.error('FAIL admin policy guardrails integration test');
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
