const admin = require('firebase-admin');

const SETTINGS_COLLECTION = 'settings';
const SETTINGS_DOC_ID = 'platform';
const CACHE_TTL_MS = 30 * 1000;

const DEFAULT_PLATFORM_SETTINGS = Object.freeze({
  platformFee: {
    percentage: 5,
    minimumFee: 50,
    maximumFee: 2000,
  },
  gcash: {
    accountNumber: process.env.GCASH_ACCOUNT_NUMBER || '09123456789',
    accountName: process.env.GCASH_ACCOUNT_NAME || 'GetGo Logistics',
    qrCodeUrl: process.env.GCASH_QR_URL || null,
  },
  referralCommission: {
    STARTER: 3,
    SILVER: 4,
    GOLD: 5,
    PLATINUM: 6,
  },
  features: {
    paymentVerificationEnabled: true,
    referralProgramEnabled: true,
    autoApproveLowRiskPayments: false,
  },
  maintenance: {
    enabled: false,
  },
});

let cachedSettings = null;
let cacheLoadedAt = 0;

function toFiniteNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function sanitizePhone(value, fallback) {
  const normalized = String(value || '').replace(/\s+/g, '');
  return normalized || fallback;
}

function sanitizeText(value, fallback) {
  const normalized = String(value || '').trim();
  return normalized || fallback;
}

function roundCurrency(value) {
  return Math.round(Number(value || 0));
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function normalizePlatformSettings(raw = {}) {
  const defaults = DEFAULT_PLATFORM_SETTINGS;
  const platformFeeRaw = raw.platformFee || {};
  const gcashRaw = raw.gcash || {};
  const referralRaw = raw.referralCommission || {};
  const featuresRaw = raw.features || {};
  const maintenanceRaw = raw.maintenance || {};

  const percentage = clamp(
    toFiniteNumber(platformFeeRaw.percentage, defaults.platformFee.percentage),
    0,
    100
  );
  const minimumFee = Math.max(
    0,
    roundCurrency(toFiniteNumber(platformFeeRaw.minimumFee, defaults.platformFee.minimumFee))
  );
  const maximumFee = Math.max(
    minimumFee,
    roundCurrency(toFiniteNumber(platformFeeRaw.maximumFee, defaults.platformFee.maximumFee))
  );

  return {
    platformFee: {
      percentage,
      minimumFee,
      maximumFee,
    },
    gcash: {
      accountNumber: sanitizePhone(gcashRaw.accountNumber, defaults.gcash.accountNumber),
      accountName: sanitizeText(gcashRaw.accountName, defaults.gcash.accountName),
      qrCodeUrl: sanitizeText(gcashRaw.qrCodeUrl, defaults.gcash.qrCodeUrl),
    },
    referralCommission: {
      STARTER: clamp(toFiniteNumber(referralRaw.STARTER, defaults.referralCommission.STARTER), 0, 100),
      SILVER: clamp(toFiniteNumber(referralRaw.SILVER, defaults.referralCommission.SILVER), 0, 100),
      GOLD: clamp(toFiniteNumber(referralRaw.GOLD, defaults.referralCommission.GOLD), 0, 100),
      PLATINUM: clamp(toFiniteNumber(referralRaw.PLATINUM, defaults.referralCommission.PLATINUM), 0, 100),
    },
    features: {
      paymentVerificationEnabled:
        featuresRaw.paymentVerificationEnabled === undefined
          ? defaults.features.paymentVerificationEnabled
          : Boolean(featuresRaw.paymentVerificationEnabled),
      referralProgramEnabled:
        featuresRaw.referralProgramEnabled === undefined
          ? defaults.features.referralProgramEnabled
          : Boolean(featuresRaw.referralProgramEnabled),
      autoApproveLowRiskPayments:
        featuresRaw.autoApproveLowRiskPayments === undefined
          ? defaults.features.autoApproveLowRiskPayments
          : Boolean(featuresRaw.autoApproveLowRiskPayments),
    },
    maintenance: {
      enabled:
        maintenanceRaw.enabled === undefined
          ? defaults.maintenance.enabled
          : Boolean(maintenanceRaw.enabled),
    },
  };
}

function mergePlatformSettings(base = {}, patch = {}) {
  return {
    ...base,
    ...patch,
    platformFee: {
      ...(base.platformFee || {}),
      ...(patch.platformFee || {}),
    },
    gcash: {
      ...(base.gcash || {}),
      ...(patch.gcash || {}),
    },
    referralCommission: {
      ...(base.referralCommission || {}),
      ...(patch.referralCommission || {}),
    },
    features: {
      ...(base.features || {}),
      ...(patch.features || {}),
    },
    maintenance: {
      ...(base.maintenance || {}),
      ...(patch.maintenance || {}),
    },
  };
}

function validatePlatformSettingsPatch(patch = {}) {
  const numericPaths = [
    ['platformFee', 'percentage'],
    ['platformFee', 'minimumFee'],
    ['platformFee', 'maximumFee'],
    ['referralCommission', 'STARTER'],
    ['referralCommission', 'SILVER'],
    ['referralCommission', 'GOLD'],
    ['referralCommission', 'PLATINUM'],
  ];
  const booleanPaths = [
    ['features', 'paymentVerificationEnabled'],
    ['features', 'referralProgramEnabled'],
    ['features', 'autoApproveLowRiskPayments'],
    ['maintenance', 'enabled'],
  ];
  const textPaths = [
    ['gcash', 'accountNumber'],
    ['gcash', 'accountName'],
  ];

  for (const [group, key] of numericPaths) {
    if (patch[group] && key in patch[group]) {
      const value = patch[group][key];
      if (value === '' || value === null || value === undefined || !Number.isFinite(Number(value))) {
        throw new Error(`${group}.${key} must be a valid number`);
      }
    }
  }

  for (const [group, key] of booleanPaths) {
    if (patch[group] && key in patch[group] && typeof patch[group][key] !== 'boolean') {
      throw new Error(`${group}.${key} must be a boolean`);
    }
  }

  for (const [group, key] of textPaths) {
    if (patch[group] && key in patch[group]) {
      const value = String(patch[group][key] || '').trim();
      if (!value) {
        throw new Error(`${group}.${key} is required`);
      }
    }
  }
}

function calculatePlatformFeeAmount(baseAmount, settings = null) {
  const normalized = normalizePlatformSettings(settings || {});
  const amount = Number(baseAmount || 0);
  if (!Number.isFinite(amount) || amount <= 0) return 0;

  const percentageFee = Math.round(amount * (normalized.platformFee.percentage / 100));
  const withMin = Math.max(percentageFee, normalized.platformFee.minimumFee);
  return Math.min(withMin, normalized.platformFee.maximumFee);
}

function getSettingsDocRef(db) {
  return db.collection(SETTINGS_COLLECTION).doc(SETTINGS_DOC_ID);
}

async function loadPlatformSettings(db, options = {}) {
  const forceRefresh = options.forceRefresh === true;
  const now = Date.now();
  if (!forceRefresh && cachedSettings && (now - cacheLoadedAt) < CACHE_TTL_MS) {
    return cachedSettings;
  }

  const settingsDoc = await getSettingsDocRef(db).get();
  const normalized = normalizePlatformSettings(settingsDoc.exists ? settingsDoc.data() : {});
  cachedSettings = normalized;
  cacheLoadedAt = now;
  return normalized;
}

async function savePlatformSettings(db, nextSettings, updatedBy = null) {
  const normalized = normalizePlatformSettings(nextSettings || {});
  const now = admin.firestore.FieldValue.serverTimestamp();
  const payload = {
    ...normalized,
    updatedAt: now,
    updatedBy: updatedBy || null,
  };

  const docRef = getSettingsDocRef(db);
  const existingDoc = await docRef.get();
  if (!existingDoc.exists) {
    payload.createdAt = now;
  }

  await docRef.set(payload, { merge: true });
  cachedSettings = normalized;
  cacheLoadedAt = Date.now();
  return normalized;
}

function clearPlatformSettingsCache() {
  cachedSettings = null;
  cacheLoadedAt = 0;
}

function isMaintenanceModeEnabled(settings = null) {
  return settings?.maintenance?.enabled === true;
}

function shouldBlockForMaintenance(settings = null, authToken = null) {
  return isMaintenanceModeEnabled(settings) && authToken?.admin !== true;
}

module.exports = {
  DEFAULT_PLATFORM_SETTINGS,
  normalizePlatformSettings,
  mergePlatformSettings,
  validatePlatformSettingsPatch,
  calculatePlatformFeeAmount,
  loadPlatformSettings,
  savePlatformSettings,
  clearPlatformSettingsCache,
  isMaintenanceModeEnabled,
  shouldBlockForMaintenance,
};
