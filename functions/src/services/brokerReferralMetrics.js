const DAILY_REFERRAL_TIME_ZONE = 'Asia/Manila';

function toFiniteNonNegativeInt(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n);
}

function getDateKeyInTimeZone(date = new Date(), timeZone = DAILY_REFERRAL_TIME_ZONE) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  if (!year || !month || !day) {
    const fallback = new Date(date);
    const y = fallback.getUTCFullYear();
    const m = String(fallback.getUTCMonth() + 1).padStart(2, '0');
    const d = String(fallback.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return `${year}-${month}-${day}`;
}

function getDailyUsageForDate(broker = {}, dateKey) {
  if (!dateKey) return 0;
  const storedKey = String(broker.dailyListingReferralDate || '').trim();
  if (storedKey !== dateKey) return 0;
  return toFiniteNonNegativeInt(broker.dailyListingReferralCount);
}

function buildListingReferralSummary(items = [], nowMs = Date.now()) {
  const summary = {
    total: 0,
    sent24h: 0,
    sent7d: 0,
    opened: 0,
    acted: 0,
    expired: 0,
  };

  items.forEach((item) => {
    summary.total += 1;

    const updatedAtMs = Number(item.updatedAtMs || 0);
    if (updatedAtMs > 0) {
      if (nowMs - updatedAtMs <= 24 * 60 * 60 * 1000) summary.sent24h += 1;
      if (nowMs - updatedAtMs <= 7 * 24 * 60 * 60 * 1000) summary.sent7d += 1;
    }

    const status = String(item.status || '').toLowerCase();
    if (status === 'opened') summary.opened += 1;
    if (status === 'acted') summary.acted += 1;
    if (status === 'expired') summary.expired += 1;
  });

  return summary;
}

module.exports = {
  DAILY_REFERRAL_TIME_ZONE,
  getDateKeyInTimeZone,
  getDailyUsageForDate,
  buildListingReferralSummary,
};

