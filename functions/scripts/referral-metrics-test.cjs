#!/usr/bin/env node

const assert = require('assert');
const {
  getDateKeyInTimeZone,
  getDailyUsageForDate,
  buildListingReferralSummary,
} = require('../src/services/brokerReferralMetrics');

function run() {
  const manilaShiftDate = new Date('2026-03-05T16:30:00.000Z');
  const dateKey = getDateKeyInTimeZone(manilaShiftDate, 'Asia/Manila');
  assert.strictEqual(dateKey, '2026-03-06', 'Expected Asia/Manila date key rollover');

  assert.strictEqual(
    getDailyUsageForDate(
      { dailyListingReferralDate: '2026-03-06', dailyListingReferralCount: 17 },
      '2026-03-06'
    ),
    17,
    'Expected usage for matching date key'
  );

  assert.strictEqual(
    getDailyUsageForDate(
      { dailyListingReferralDate: '2026-03-05', dailyListingReferralCount: 999 },
      '2026-03-06'
    ),
    0,
    'Expected usage reset on date boundary'
  );

  const nowMs = Date.parse('2026-03-06T12:00:00.000Z');
  const summary = buildListingReferralSummary([
    { status: 'opened', updatedAtMs: nowMs - 1 * 60 * 60 * 1000 },
    { status: 'acted', updatedAtMs: nowMs - 3 * 24 * 60 * 60 * 1000 },
    { status: 'expired', updatedAtMs: nowMs - 8 * 24 * 60 * 60 * 1000 },
  ], nowMs);

  assert.deepStrictEqual(summary, {
    total: 3,
    sent24h: 1,
    sent7d: 2,
    opened: 1,
    acted: 1,
    expired: 1,
  }, 'Expected summary buckets to be computed correctly');

  console.log('referral-metrics-test: PASS');
}

try {
  run();
} catch (error) {
  console.error('referral-metrics-test: FAIL');
  console.error(error);
  process.exit(1);
}

