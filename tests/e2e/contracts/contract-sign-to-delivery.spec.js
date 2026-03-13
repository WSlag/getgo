import { test, expect } from '../fixtures/auth.fixture.js';
import { generateTestUser, EMULATOR_PROJECT_ID } from '../utils/test-data.js';

const FIRESTORE_BASE = `http://127.0.0.1:8080/v1/projects/${EMULATOR_PROJECT_ID}/databases/(default)/documents`;
const FIRESTORE_RUN_QUERY = `http://127.0.0.1:8080/v1/projects/${EMULATOR_PROJECT_ID}/databases/(default)/documents:runQuery`;

const OWNER_HEADERS = {
  Authorization: 'Bearer owner',
  'Content-Type': 'application/json',
};

function nowTimestamp() {
  return { timestampValue: new Date().toISOString() };
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function firestoreValueToJs(value) {
  if (!value || typeof value !== 'object') return null;
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('booleanValue' in value) return Boolean(value.booleanValue);
  if ('nullValue' in value) return null;
  if ('timestampValue' in value) return value.timestampValue;
  if ('mapValue' in value) {
    const fields = value.mapValue?.fields || {};
    return Object.fromEntries(
      Object.entries(fields).map(([k, v]) => [k, firestoreValueToJs(v)])
    );
  }
  if ('arrayValue' in value) {
    const values = value.arrayValue?.values || [];
    return values.map((entry) => firestoreValueToJs(entry));
  }
  return null;
}

async function patchDoc(path, fields) {
  const resp = await fetch(`${FIRESTORE_BASE}/${path}`, {
    method: 'PATCH',
    headers: OWNER_HEADERS,
    body: JSON.stringify({ fields }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Failed to patch ${path}: ${resp.status} ${body}`);
  }
}

async function getDoc(path) {
  const resp = await fetch(`${FIRESTORE_BASE}/${path}`, {
    headers: { Authorization: 'Bearer owner' },
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Failed to fetch ${path}: ${resp.status} ${body}`);
  }

  const payload = await resp.json();
  return Object.fromEntries(
    Object.entries(payload.fields || {}).map(([k, v]) => [k, firestoreValueToJs(v)])
  );
}

async function getUserUidByPhone(phoneNumber) {
  const resp = await fetch(FIRESTORE_RUN_QUERY, {
    method: 'POST',
    headers: OWNER_HEADERS,
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'users' }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'phone' },
            op: 'EQUAL',
            value: { stringValue: phoneNumber },
          },
        },
        limit: 1,
      },
    }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Failed to query users by phone: ${resp.status} ${body}`);
  }

  const rows = await resp.json();
  const document = rows.find((row) => row.document)?.document;
  if (!document?.name) return null;
  return document.name.split('/').pop() || null;
}

async function getShipmentByContractId(contractId) {
  const resp = await fetch(FIRESTORE_RUN_QUERY, {
    method: 'POST',
    headers: OWNER_HEADERS,
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'shipments' }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'contractId' },
            op: 'EQUAL',
            value: { stringValue: contractId },
          },
        },
        limit: 1,
      },
    }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Failed to query shipments: ${resp.status} ${body}`);
  }

  const rows = await resp.json();
  const document = rows.find((row) => row.document)?.document;
  if (!document) return null;

  return {
    id: document.name?.split('/').pop() || null,
    ...Object.fromEntries(
      Object.entries(document.fields || {}).map(([k, v]) => [k, firestoreValueToJs(v)])
    ),
  };
}

async function signContractFromModal(page) {
  const signButton = page.locator('button').filter({ hasText: /^Sign Contract$/i }).first();
  await expect(signButton).toBeVisible({ timeout: 15000 });
  await signButton.click();

  const liabilityCheckbox = page.locator('input[type="checkbox"]').first();
  await expect(liabilityCheckbox).toBeVisible({ timeout: 5000 });
  await liabilityCheckbox.check();

  const confirmButton = page.locator('button').filter({ hasText: /Confirm & Sign Contract/i }).first();
  await expect(confirmButton).toBeEnabled({ timeout: 5000 });
  await confirmButton.click();
}

async function openContractModal(page, contractNumber) {
  const escaped = escapeRegExp(contractNumber);
  const contractHeading = page.getByText(new RegExp(`Contract\\s*#\\s*${escaped}`, 'i')).first();
  await expect(contractHeading).toBeVisible({ timeout: 30000 });
  await contractHeading.click();
  await expect(page.getByRole('dialog', { name: new RegExp(escaped, 'i') })).toBeVisible({ timeout: 20000 });
}

async function waitForContract(conditionFn, contractId, timeout = 90000) {
  await expect.poll(async () => {
    const contract = await getDoc(`contracts/${contractId}`);
    return Boolean(conditionFn(contract));
  }, {
    timeout,
    intervals: [1000, 1500, 2000],
  }).toBe(true);
}

async function loginWithRetry({ authHelper, page, phoneNumber, attempts = 3 }) {
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      await authHelper.login(phoneNumber);
      const loggedIn = await authHelper.isLoggedIn().catch(() => false);
      if (loggedIn) return;
      if (attempt < attempts) {
        await page.waitForTimeout(1200);
        continue;
      }
      return;
    } catch (error) {
      const loggedIn = await authHelper.isLoggedIn().catch(() => false);
      if (loggedIn) return;
      lastError = error;
      if (attempt < attempts) {
        await page.waitForTimeout(1500);
      }
    }
  }
  throw lastError;
}

test.describe('Contract Lifecycle Flow', () => {
  test.beforeEach(async ({ authHelper }) => {
    await authHelper.clearEmulatorData();
  });

  test('should complete shipper/trucker signing up to delivery confirmation', async ({
    page,
    authHelper,
    testPhoneNumbers,
  }) => {
    test.setTimeout(240000);

    // Create both accounts first; keep shipper session active for first signing step.
    await loginWithRetry({ authHelper, page, phoneNumber: testPhoneNumbers.trucker });
    await authHelper.register(generateTestUser('trucker', 21));

    await loginWithRetry({ authHelper, page, phoneNumber: testPhoneNumbers.shipper });
    await authHelper.register(generateTestUser('shipper', 21));

    const shipperUid = await getUserUidByPhone(testPhoneNumbers.shipper);
    const truckerUid = await getUserUidByPhone(testPhoneNumbers.trucker);
    expect(shipperUid).toBeTruthy();
    expect(truckerUid).toBeTruthy();

    const stamp = Date.now();
    const contractId = `e2e-contract-lifecycle-${stamp}`;
    const contractNumber = `E2E-LIFE-${String(stamp).slice(-6)}`;
    const bidId = `e2e-bid-lifecycle-${stamp}`;
    const createdAt = nowTimestamp();

    // Ensure signing doesn't require compliance documents for this E2E scenario.
    await patchDoc(`users/${truckerUid}/truckerCompliance/profile`, {
      docsRequiredOnSigning: { booleanValue: false },
      updatedAt: createdAt,
    });

    // Seed a draft contract directly in Firestore emulator.
    await patchDoc(`contracts/${contractId}`, {
      bidId: { stringValue: bidId },
      contractNumber: { stringValue: contractNumber },
      status: { stringValue: 'draft' },
      listingType: { stringValue: 'cargo' },
      listingOwnerId: { stringValue: shipperUid },
      listingOwnerName: { stringValue: 'E2E Shipper' },
      bidderId: { stringValue: truckerUid },
      bidderName: { stringValue: 'E2E Trucker' },
      shipperId: { stringValue: shipperUid },
      truckerId: { stringValue: truckerUid },
      participantIds: {
        arrayValue: {
          values: [{ stringValue: shipperUid }, { stringValue: truckerUid }],
        },
      },
      pickupAddress: { stringValue: 'Manila' },
      pickupCity: { stringValue: 'Manila' },
      deliveryAddress: { stringValue: 'Cebu' },
      deliveryCity: { stringValue: 'Cebu' },
      pickupDate: { timestampValue: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() },
      expectedDeliveryDate: { timestampValue: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString() },
      cargoType: { stringValue: 'Construction Materials' },
      cargoWeight: { integerValue: '10' },
      cargoWeightUnit: { stringValue: 'tons' },
      vehicleType: { stringValue: 'Closed Van' },
      vehiclePlateNumber: { stringValue: 'ABC1234' },
      agreedPrice: { integerValue: '45000' },
      platformFee: { integerValue: '0' },
      platformFeePaid: { booleanValue: true },
      platformFeePayerId: { stringValue: truckerUid },
      createdAt,
      updatedAt: createdAt,
    });

    // Shipper signs first (already logged in from setup).
    await authHelper.navigateTo('contracts');
    await openContractModal(page, contractNumber);
    await signContractFromModal(page);
    await waitForContract(
      (contract) => contract?.status === 'draft' && Boolean(contract?.shipperSignature) && !contract?.truckerSignature,
      contractId
    );

    // Trucker signs second to fully execute the contract and create shipment.
    await loginWithRetry({ authHelper, page, phoneNumber: testPhoneNumbers.trucker });
    await authHelper.navigateTo('contracts');
    await openContractModal(page, contractNumber);
    await signContractFromModal(page);
    await waitForContract(
      (contract) => contract?.status === 'signed' && Boolean(contract?.shipperSignature) && Boolean(contract?.truckerSignature),
      contractId
    );

    await expect.poll(async () => {
      const shipment = await getShipmentByContractId(contractId);
      return shipment?.status || 'missing';
    }, {
      timeout: 20000,
      intervals: [500, 1000, 1000],
    }).toBe('pending_pickup');

    await authHelper.navigateTo('tracking');

    // Trucker confirms pickup.
    const pickUpButton = page.locator('button').filter({ hasText: /^Pick Up$/i }).first();
    await expect(pickUpButton).toBeVisible({ timeout: 15000 });
    await pickUpButton.click();

    await expect.poll(async () => {
      const shipment = await getShipmentByContractId(contractId);
      return shipment?.status || 'missing';
    }, {
      timeout: 20000,
      intervals: [500, 1000, 1000],
    }).toBe('picked_up');

    // Shipper confirms delivery.
    await loginWithRetry({ authHelper, page, phoneNumber: testPhoneNumbers.shipper });
    await authHelper.navigateTo('tracking');

    const deliveredButton = page.locator('button').filter({ hasText: /^Delivered$/i }).first();
    await expect(deliveredButton).toBeVisible({ timeout: 20000 });
    await deliveredButton.click();

    // Rating modal may appear after completion.
    await page.keyboard.press('Escape').catch(() => {});

    await expect.poll(async () => {
      const contract = await getDoc(`contracts/${contractId}`);
      return contract?.status || 'missing';
    }, {
      timeout: 25000,
      intervals: [750, 1000, 1000],
    }).toBe('completed');

    await expect.poll(async () => {
      const shipment = await getShipmentByContractId(contractId);
      return shipment?.status || 'missing';
    }, {
      timeout: 25000,
      intervals: [750, 1000, 1000],
    }).toBe('delivered');

    await expect(page.locator('text=/Delivered/i').first()).toBeVisible({ timeout: 15000 });
  });
});
