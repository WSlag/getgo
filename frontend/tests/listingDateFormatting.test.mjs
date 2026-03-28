import test from 'node:test';
import assert from 'node:assert/strict';

import {
  formatListingPostedAge,
  formatListingScheduleDate,
} from '../src/utils/listingDateFormatting.js';

const REAL_DATE_NOW = Date.now;

function withFrozenNow(isoString, fn) {
  const frozen = new Date(isoString).getTime();
  Date.now = () => frozen;
  try {
    fn();
  } finally {
    Date.now = REAL_DATE_NOW;
  }
}

test('formatListingScheduleDate normalizes parseable date strings', () => {
  assert.equal(formatListingScheduleDate('2026-03-15'), '3/15/2026');
  assert.equal(formatListingScheduleDate('3/15/2026'), '3/15/2026');
});

test('formatListingScheduleDate handles timestamp-like values', () => {
  const seconds = Math.floor(Date.UTC(2026, 2, 20, 12, 0, 0) / 1000);
  assert.equal(formatListingScheduleDate({ seconds }), '3/20/2026');
});

test('formatListingScheduleDate preserves non-date text and supports fallback', () => {
  assert.equal(formatListingScheduleDate('Flexible'), 'Flexible');
  assert.equal(formatListingScheduleDate(null, { fallback: 'N/A' }), 'N/A');
});

test('formatListingPostedAge returns short relative values', () => {
  withFrozenNow('2026-03-29T12:00:00.000Z', () => {
    assert.equal(formatListingPostedAge(new Date('2026-03-29T11:59:40.000Z')), 'Just now');
    assert.equal(formatListingPostedAge(new Date('2026-03-29T11:15:00.000Z')), '45m');
    assert.equal(formatListingPostedAge(new Date('2026-03-29T07:00:00.000Z')), '5h');
    assert.equal(formatListingPostedAge(new Date('2026-03-28T10:00:00.000Z')), 'Yesterday');
    assert.equal(formatListingPostedAge(new Date('2026-03-19T12:00:00.000Z')), '10d');
    assert.equal(formatListingPostedAge(new Date('2025-12-29T12:00:00.000Z')), '3mo');
    assert.equal(formatListingPostedAge(new Date('2025-02-22T12:00:00.000Z')), '1y');
  });
});

test('formatListingPostedAge supports fallback strings safely', () => {
  withFrozenNow('2026-03-29T12:00:00.000Z', () => {
    assert.equal(formatListingPostedAge(null, '3h'), '3h');
    assert.equal(formatListingPostedAge(null, '2026-03-28'), 'Yesterday');
    assert.equal(formatListingPostedAge(new Date('2026-03-29T12:10:00.000Z')), 'Just now');
  });
});

