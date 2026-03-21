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
    accountNumber: process.env.GCASH_ACCOUNT_NUMBER || '09272241557',
    accountName: process.env.GCASH_ACCOUNT_NAME || 'GetGo Logistics',
    qrCodeUrl: process.env.GCASH_QR_URL || '/assets/gcash_qrcode.png',
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
  communications: {
    broadcastEnabled: true,
    welcome: {
      enabled: true,
      title: 'Welcome to GetGo',
      message: 'Welcome to GetGo. We are glad to have you onboard. You can check Help & Support anytime for tips and assistance.',
    },
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

function sanitizeBoundedText(value, fallback, maxLength) {
  const normalized = sanitizeText(value, fallback);
  return normalized.length > maxLength ? normalized.slice(0, maxLength) : normalized;
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
  const communicationsRaw = raw.communications || {};
  const welcomeRaw = communicationsRaw.welcome || {};

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
    communications: {
      broadcastEnabled:
        communicationsRaw.broadcastEnabled === undefined
          ? defaults.communications.broadcastEnabled
          : Boolean(communicationsRaw.broadcastEnabled),
      welcome: {
        enabled:
          welcomeRaw.enabled === undefined
            ? defaults.communications.welcome.enabled
            : Boolean(welcomeRaw.enabled),
        title: sanitizeBoundedText(
          welcomeRaw.title,
          defaults.communications.welcome.title,
          120
        ),
        message: sanitizeBoundedText(
          welcomeRaw.message,
          defaults.communications.welcome.message,
          2000
        ),
      },
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
    communications: {
      ...(base.communications || {}),
      ...(patch.communications || {}),
      welcome: {
        ...((base.communications && base.communications.welcome) || {}),
        ...((patch.communications && patch.communications.welcome) || {}),
      },
    },
  };
}

function getNestedValue(value, path = []) {
  return path.reduce((current, key) => {
    if (!current || typeof current !== 'object') return undefined;
    return current[key];
  }, value);
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
    ['communications', 'broadcastEnabled'],
    ['communications', 'welcome', 'enabled'],
  ];
  const textPaths = [
    ['gcash', 'accountNumber'],
    ['gcash', 'accountName'],
    ['communications', 'welcome', 'title'],
    ['communications', 'welcome', 'message'],
  ];

  for (const [group, key] of numericPaths) {
    if (patch[group] && key in patch[group]) {
      const value = patch[group][key];
      if (value === '' || value === null || value === undefined || !Number.isFinite(Number(value))) {
        throw new Error(`${group}.${key} must be a valid number`);
      }
    }
  }

  for (const path of booleanPaths) {
    const parentPath = path.slice(0, -1);
    const key = path[path.length - 1];
    const parentValue = getNestedValue(patch, parentPath);
    if (
      parentValue
      && typeof parentValue === 'object'
      && Object.prototype.hasOwnProperty.call(parentValue, key)
      && typeof parentValue[key] !== 'boolean'
    ) {
      throw new Error(`${path.join('.')} must be a boolean`);
    }
  }

  for (const path of textPaths) {
    const parentPath = path.slice(0, -1);
    const key = path[path.length - 1];
    const parentValue = getNestedValue(patch, parentPath);
    if (
      parentValue
      && typeof parentValue === 'object'
      && Object.prototype.hasOwnProperty.call(parentValue, key)
    ) {
      const value = String(parentValue[key] || '').trim();
      if (!value) {
        throw new Error(`${path.join('.')} is required`);
      }
      if (path.join('.') === 'communications.welcome.title' && value.length > 120) {
        throw new Error('communications.welcome.title must be 120 characters or less');
      }
      if (path.join('.') === 'communications.welcome.message' && value.length > 2000) {
        throw new Error('communications.welcome.message must be 2000 characters or less');
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
