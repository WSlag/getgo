import { test, expect } from '../fixtures/auth.fixture.js';
import { generateTestUser, EMULATOR_PROJECT_ID } from '../utils/test-data.js';

const FIRESTORE_BASE = `http://127.0.0.1:8080/v1/projects/${EMULATOR_PROJECT_ID}/databases/(default)/documents`;
const FIRESTORE_RUN_QUERY = `${FIRESTORE_BASE}:runQuery`;

const OWNER_HEADERS = {
  Authorization: 'Bearer owner',
  'Content-Type': 'application/json',
};

function nowTimestamp() {
  return { timestampValue: new Date().toISOString() };
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

async function openConversation(page, otherPartyName) {
  const conversationCard = page.locator('main button').filter({
    hasText: new RegExp(otherPartyName, 'i'),
  }).first();
  await expect(conversationCard).toBeVisible({ timeout: 30000 });
  await conversationCard.click();
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 15000 });
}

async function sendChatMessage(page, message) {
  const chatInput = page.locator('textarea[placeholder="Type a message..."]').first();
  await expect(chatInput).toBeVisible({ timeout: 15000 });
  await chatInput.fill(message);
  await chatInput.press('Enter');
  await expect(chatInput).toHaveValue('', { timeout: 15000 });
}

async function expectChatBubble(page, message, timeout = 15000) {
  const bubbleText = page.locator('[role="dialog"] p').filter({
    hasText: new RegExp(message.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
  }).first();
  await expect(bubbleText).toBeVisible({ timeout });
}

test.describe('Chat Conversation Flow', () => {
  test.beforeEach(async ({ authHelper }) => {
    await authHelper.clearEmulatorData();
  });

  test('should let shipper and trucker exchange messages in one conversation', async ({
    page,
    authHelper,
    testPhoneNumbers,
  }) => {
    test.setTimeout(240000);

    const shipperProfile = generateTestUser('shipper', 31);
    const truckerProfile = generateTestUser('trucker', 31);

    await loginWithRetry({ authHelper, page, phoneNumber: testPhoneNumbers.shipper });
    await authHelper.register(shipperProfile);

    await loginWithRetry({ authHelper, page, phoneNumber: testPhoneNumbers.trucker });
    await authHelper.register(truckerProfile);

    const shipperUid = await getUserUidByPhone(testPhoneNumbers.shipper);
    const truckerUid = await getUserUidByPhone(testPhoneNumbers.trucker);
    expect(shipperUid).toBeTruthy();
    expect(truckerUid).toBeTruthy();

    const stamp = Date.now();
    const bidId = `e2e-chat-bid-${stamp}`;
    const createdAt = nowTimestamp();
    const initialBidMessage = `Initial bid thread ${stamp}`;
    const shipperMessage = `Shipper message ${stamp}`;
    const truckerMessage = `Trucker reply ${stamp}`;

    await patchDoc(`bids/${bidId}`, {
      bidderId: { stringValue: truckerUid },
      bidderName: { stringValue: truckerProfile.name },
      bidderType: { stringValue: 'trucker' },
      listingOwnerId: { stringValue: shipperUid },
      listingOwnerName: { stringValue: shipperProfile.name },
      listingType: { stringValue: 'cargo' },
      listingId: { stringValue: `e2e-cargo-${stamp}` },
      cargoListingId: { stringValue: `e2e-cargo-${stamp}` },
      origin: { stringValue: 'Manila' },
      destination: { stringValue: 'Cebu' },
      cargoType: { stringValue: 'General Goods' },
      cargoWeight: { integerValue: '5' },
      cargoWeightUnit: { stringValue: 'tons' },
      message: { stringValue: initialBidMessage },
      price: { integerValue: '25000' },
      status: { stringValue: 'pending' },
      createdAt,
      updatedAt: createdAt,
    });

    await loginWithRetry({ authHelper, page, phoneNumber: testPhoneNumbers.shipper });
    await authHelper.navigateTo('messages');
    await openConversation(page, truckerProfile.name);
    await sendChatMessage(page, shipperMessage);
    await expectChatBubble(page, shipperMessage);

    await page.keyboard.press('Escape').catch(() => {});

    await loginWithRetry({ authHelper, page, phoneNumber: testPhoneNumbers.trucker });
    await authHelper.navigateTo('messages');
    await openConversation(page, shipperProfile.name);
    await expectChatBubble(page, shipperMessage, 30000);
    await sendChatMessage(page, truckerMessage);
    await expectChatBubble(page, truckerMessage);

    await page.keyboard.press('Escape').catch(() => {});

    await loginWithRetry({ authHelper, page, phoneNumber: testPhoneNumbers.shipper });
    await authHelper.navigateTo('messages');
    await openConversation(page, truckerProfile.name);
    await expectChatBubble(page, truckerMessage, 30000);
  });
});
