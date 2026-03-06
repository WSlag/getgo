const admin = require('firebase-admin');
const axios = require('axios');
const {
  sendPlatformFeeReminders,
} = require('../src/scheduled/platformFeeReminders');

const PROJECT_ID = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || 'getgoph-a09bb';
const EMULATOR_HOSTS = {
  auth: process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099',
  firestore: process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080',
};

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function clearEmulators() {
  await axios.delete(`http://${EMULATOR_HOSTS.auth}/emulator/v1/projects/${PROJECT_ID}/accounts`);
  await axios.delete(`http://${EMULATOR_HOSTS.firestore}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`);
}

async function invokeReminderScheduler() {
  await sendPlatformFeeReminders.run({
    scheduleTime: new Date().toISOString(),
  });
}

async function seedUser(uid, role, outstandingPlatformFees = 0) {
  const now = admin.firestore.FieldValue.serverTimestamp();
  await admin.auth().createUser({
    uid,
    displayName: uid,
  });
  await admin.firestore().collection('users').doc(uid).set({
    name: uid,
    role,
    accountStatus: 'active',
    suspensionReason: null,
    outstandingPlatformFees,
    outstandingFeeContracts: [],
    createdAt: now,
    updatedAt: now,
  });
}

function hoursFromNow(hours) {
  return new Date(Date.now() + (hours * 60 * 60 * 1000));
}

async function seedContract({
  contractId,
  contractNumber,
  shipperUid,
  truckerUid,
  platformFee,
  dueHoursOffset,
  reminderStages = [],
}) {
  const now = new Date();
  const dueDate = hoursFromNow(dueHoursOffset);
  const billingStartedAt = new Date(now);
  billingStartedAt.setDate(now.getDate() - 2);

  const db = admin.firestore();
  await db.collection('contracts').doc(contractId).set({
    contractNumber,
    listingType: 'cargo',
    status: 'signed',
    participantIds: [shipperUid, truckerUid],
    listingOwnerId: shipperUid,
    bidderId: truckerUid,
    platformFeePayerId: truckerUid,
    platformFee,
    platformFeePaid: false,
    platformFeeStatus: 'outstanding',
    platformFeeBillingStartedAt: admin.firestore.Timestamp.fromDate(billingStartedAt),
    platformFeeDueDate: admin.firestore.Timestamp.fromDate(dueDate),
    platformFeeReminders: reminderStages,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

async function notificationDocExists(userId, docId) {
  const doc = await admin.firestore().collection(`users/${userId}/notifications`).doc(docId).get();
  return doc.exists ? doc.data() : null;
}

async function notificationCount(userId) {
  const snap = await admin.firestore().collection(`users/${userId}/notifications`).get();
  return snap.size;
}

async function getContract(contractId) {
  const doc = await admin.firestore().collection('contracts').doc(contractId).get();
  assert(doc.exists, `Missing contract ${contractId}`);
  return doc.data() || {};
}

async function main() {
  process.env.FIREBASE_AUTH_EMULATOR_HOST = EMULATOR_HOSTS.auth;
  process.env.FIRESTORE_EMULATOR_HOST = EMULATOR_HOSTS.firestore;

  admin.initializeApp({ projectId: PROJECT_ID });
  const db = admin.firestore();

  console.log('Clearing emulator state...');
  await clearEmulators();

  await db.collection('settings').doc('platform').set({
    features: {
      platformFeeReminderNotificationsEnabled: true,
    },
  }, { merge: true });

  const shipperUid = 'shipper-reminder-smoke';
  const uDue = 'trucker-reminder-due24';
  const uOver1 = 'trucker-reminder-over1';
  const uOver2 = 'trucker-reminder-over2';
  const uOver3 = 'trucker-reminder-over3';
  const uRestrict = 'trucker-reminder-restrict';

  console.log('Seeding users...');
  await seedUser(shipperUid, 'shipper', 0);
  await seedUser(uDue, 'trucker', 4000);
  await seedUser(uOver1, 'trucker', 4500);
  await seedUser(uOver2, 'trucker', 4700);
  await seedUser(uOver3, 'trucker', 4900);
  await seedUser(uRestrict, 'trucker', 16000);

  console.log('Seeding contracts for due/overdue/restriction stages...');
  await seedContract({
    contractId: 'ct-reminder-due24',
    contractNumber: 'KC-SMOKE-DUE24',
    shipperUid,
    truckerUid: uDue,
    platformFee: 4000,
    dueHoursOffset: 12,
    reminderStages: ['due_initial'],
  });

  await seedContract({
    contractId: 'ct-reminder-over1',
    contractNumber: 'KC-SMOKE-OVER1',
    shipperUid,
    truckerUid: uOver1,
    platformFee: 4500,
    dueHoursOffset: -2,
    reminderStages: ['due_initial', 'due_24h'],
  });

  await seedContract({
    contractId: 'ct-reminder-over2',
    contractNumber: 'KC-SMOKE-OVER2',
    shipperUid,
    truckerUid: uOver2,
    platformFee: 4700,
    dueHoursOffset: -26,
    reminderStages: ['due_initial', 'due_24h'],
  });

  await seedContract({
    contractId: 'ct-reminder-over3',
    contractNumber: 'KC-SMOKE-OVER3',
    shipperUid,
    truckerUid: uOver3,
    platformFee: 4900,
    dueHoursOffset: -50,
    reminderStages: ['due_initial', 'due_24h'],
  });

  await seedContract({
    contractId: 'ct-reminder-restrict',
    contractNumber: 'KC-SMOKE-RESTRICT',
    shipperUid,
    truckerUid: uRestrict,
    platformFee: 5000,
    dueHoursOffset: -98,
    reminderStages: ['due_initial', 'due_24h'],
  });

  console.log('Invoking sendPlatformFeeReminders (first pass)...');
  await invokeReminderScheduler();

  console.log('Asserting stage notifications were created...');
  assert(await notificationDocExists(uDue, 'platform_fee_ct-reminder-due24_due_24h'), 'Missing due_24h notification');
  assert(await notificationDocExists(uOver1, 'platform_fee_ct-reminder-over1_overdue_day_1'), 'Missing overdue day 1 notification');
  assert(await notificationDocExists(uOver2, 'platform_fee_ct-reminder-over2_overdue_day_2'), 'Missing overdue day 2 notification');
  assert(await notificationDocExists(uOver3, 'platform_fee_ct-reminder-over3_overdue_day_3'), 'Missing overdue day 3 notification');
  assert(await notificationDocExists(uRestrict, 'platform_fee_ct-reminder-restrict_overdue_day_3'), 'Missing restriction path overdue day 3 notification');
  assert(await notificationDocExists(uRestrict, 'platform_fee_ct-reminder-restrict_cap_restriction_notice'), 'Missing cap restriction notification');

  const dueContract = await getContract('ct-reminder-due24');
  assert(Array.isArray(dueContract.platformFeeReminders) && dueContract.platformFeeReminders.includes('due_24h'), 'Expected due_24h reminder stage persisted');

  const over1Contract = await getContract('ct-reminder-over1');
  assert(over1Contract.platformFeeStatus === 'overdue', 'Expected overdue status for day1 contract');

  const countsAfterFirstRun = {
    [uDue]: await notificationCount(uDue),
    [uOver1]: await notificationCount(uOver1),
    [uOver2]: await notificationCount(uOver2),
    [uOver3]: await notificationCount(uOver3),
    [uRestrict]: await notificationCount(uRestrict),
  };

  console.log('Invoking sendPlatformFeeReminders (second pass for dedupe)...');
  await invokeReminderScheduler();

  const countsAfterSecondRun = {
    [uDue]: await notificationCount(uDue),
    [uOver1]: await notificationCount(uOver1),
    [uOver2]: await notificationCount(uOver2),
    [uOver3]: await notificationCount(uOver3),
    [uRestrict]: await notificationCount(uRestrict),
  };

  for (const [uid, count] of Object.entries(countsAfterFirstRun)) {
    assert(
      countsAfterSecondRun[uid] === count,
      `Expected deduped notification count for ${uid}. First=${count}, second=${countsAfterSecondRun[uid]}`
    );
  }

  console.log('Platform fee reminder smoke test passed. Stage progression and dedupe verified.');
}

main().catch((error) => {
  console.error('platform-fee-reminders-smoke failed:', error);
  process.exit(1);
});
