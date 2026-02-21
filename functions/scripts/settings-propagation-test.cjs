const assert = require('node:assert/strict');
const {
  loadPlatformSettings,
  savePlatformSettings,
  mergePlatformSettings,
  calculatePlatformFeeAmount,
  clearPlatformSettingsCache,
  shouldBlockForMaintenance,
} = require('../src/config/platformSettings');

class FakeDoc {
  constructor(store, key) {
    this.store = store;
    this.key = key;
  }

  async get() {
    const value = this.store[this.key];
    return {
      exists: value !== undefined,
      data: () => value,
    };
  }

  async set(payload, options = {}) {
    const previous = this.store[this.key] || {};
    if (options.merge) {
      this.store[this.key] = { ...previous, ...payload };
      return;
    }
    this.store[this.key] = payload;
  }
}

class FakeDb {
  constructor() {
    this.store = {};
  }

  collection(name) {
    return {
      doc: (id) => new FakeDoc(this.store, `${name}/${id}`),
    };
  }
}

async function run() {
  const db = new FakeDb();
  clearPlatformSettingsCache();

  const initial = await loadPlatformSettings(db, { forceRefresh: true });

  const patch = {
    platformFee: {
      percentage: 7.5,
      minimumFee: 120,
      maximumFee: 5000,
    },
    gcash: {
      accountNumber: '09991234567',
      accountName: 'Admin Updated Name',
    },
    referralCommission: {
      STARTER: 9,
      SILVER: 10,
      GOLD: 11,
      PLATINUM: 12,
    },
    features: {
      paymentVerificationEnabled: false,
      referralProgramEnabled: false,
      autoApproveLowRiskPayments: true,
    },
    maintenance: {
      enabled: true,
    },
  };

  const merged = mergePlatformSettings(initial, patch);
  const saved = await savePlatformSettings(db, merged, 'admin-test-uid');
  const reloaded = await loadPlatformSettings(db, { forceRefresh: true });

  assert.equal(saved.platformFee.percentage, 7.5, 'saved percentage should be updated');
  assert.equal(reloaded.platformFee.percentage, 7.5, 'reloaded percentage should be updated');
  assert.equal(reloaded.platformFee.minimumFee, 120, 'minimum fee should be updated');
  assert.equal(reloaded.platformFee.maximumFee, 5000, 'maximum fee should be updated');

  assert.equal(reloaded.gcash.accountNumber, '09991234567', 'GCash number should be updated');
  assert.equal(reloaded.gcash.accountName, 'Admin Updated Name', 'GCash name should be updated');

  assert.equal(reloaded.referralCommission.STARTER, 9, 'STARTER rate should be updated');
  assert.equal(reloaded.referralCommission.SILVER, 10, 'SILVER rate should be updated');
  assert.equal(reloaded.referralCommission.GOLD, 11, 'GOLD rate should be updated');
  assert.equal(reloaded.referralCommission.PLATINUM, 12, 'PLATINUM rate should be updated');

  assert.equal(
    reloaded.features.paymentVerificationEnabled,
    false,
    'paymentVerificationEnabled toggle should be updated'
  );
  assert.equal(
    reloaded.features.referralProgramEnabled,
    false,
    'referralProgramEnabled toggle should be updated'
  );
  assert.equal(
    reloaded.features.autoApproveLowRiskPayments,
    true,
    'autoApproveLowRiskPayments toggle should be updated'
  );
  assert.equal(reloaded.maintenance.enabled, true, 'maintenance toggle should be updated');

  assert.equal(
    calculatePlatformFeeAmount(10000, reloaded),
    750,
    'fee calculation should use the updated percentage'
  );
  assert.equal(
    calculatePlatformFeeAmount(1000, reloaded),
    120,
    'fee calculation should respect updated minimum fee'
  );
  assert.equal(
    calculatePlatformFeeAmount(1000000, reloaded),
    5000,
    'fee calculation should respect updated maximum fee'
  );

  assert.equal(
    shouldBlockForMaintenance(reloaded, { admin: false }),
    true,
    'maintenance mode should block non-admin requests'
  );
  assert.equal(
    shouldBlockForMaintenance(reloaded, { admin: true }),
    false,
    'maintenance mode should not block admin requests'
  );

  console.log('PASS settings propagation test');
}

run().catch((error) => {
  console.error('FAIL settings propagation test');
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
