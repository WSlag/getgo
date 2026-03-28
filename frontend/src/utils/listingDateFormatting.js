const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

function normalizeYear(yearToken) {
  const year = Number(yearToken);
  if (!Number.isFinite(year)) return null;
  if (yearToken.length === 2) {
    return year >= 70 ? 1900 + year : 2000 + year;
  }
  return year;
}

function parseDateOnlyString(value) {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!text) return null;

  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const [, yearToken, monthToken, dayToken] = isoMatch;
    const year = Number(yearToken);
    const month = Number(monthToken);
    const day = Number(dayToken);
    if (Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)) {
      return new Date(year, month - 1, day, 12, 0, 0, 0);
    }
  }

  const slashMatch = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (slashMatch) {
    const [, monthToken, dayToken, yearToken] = slashMatch;
    const month = Number(monthToken);
    const day = Number(dayToken);
    const year = normalizeYear(yearToken);
    if (Number.isFinite(month) && Number.isFinite(day) && Number.isFinite(year)) {
      return new Date(year, month - 1, day, 12, 0, 0, 0);
    }
  }

  return null;
}

function toDateOrNull(value) {
  if (value == null) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const normalized = value < 1e12 ? value * 1000 : value;
    const date = new Date(normalized);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof value?.toDate === 'function') {
    const converted = value.toDate();
    return converted instanceof Date && !Number.isNaN(converted.getTime()) ? converted : null;
  }

  if (typeof value?.seconds === 'number') {
    const date = new Date(value.seconds * 1000);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof value?._seconds === 'number') {
    const date = new Date(value._seconds * 1000);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;

    if (/^\d+$/.test(trimmed)) {
      const numeric = Number(trimmed);
      if (Number.isFinite(numeric)) {
        const normalized = trimmed.length <= 10 ? numeric * 1000 : numeric;
        const date = new Date(normalized);
        return Number.isNaN(date.getTime()) ? null : date;
      }
    }

    const dateOnly = parseDateOnlyString(trimmed);
    if (dateOnly) return dateOnly;

    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}

function formatShortRelativeTime(date) {
  const nowMs = Date.now();
  const timestamp = date.getTime();
  if (!Number.isFinite(timestamp)) return '';

  const diffMs = nowMs - timestamp;
  if (diffMs <= 0) return 'Just now';
  if (diffMs < MINUTE_MS) return 'Just now';
  if (diffMs < HOUR_MS) return `${Math.max(1, Math.floor(diffMs / MINUTE_MS))}m`;
  if (diffMs < DAY_MS) return `${Math.max(1, Math.floor(diffMs / HOUR_MS))}h`;
  if (diffMs < 2 * DAY_MS) return 'Yesterday';
  const days = Math.max(2, Math.floor(diffMs / DAY_MS));
  if (days < 30) return `${days}d`;
  if (days < 365) return `${Math.floor(days / 30)}mo`;
  return `${Math.floor(days / 365)}y`;
}

function sanitizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

export function formatListingScheduleDate(value, options = {}) {
  const { locale = 'en-PH', fallback = '' } = options;
  const parsed = toDateOrNull(value);
  if (!parsed) {
    const text = sanitizeText(value);
    if (text) return text;
    return sanitizeText(fallback);
  }
  return new Intl.DateTimeFormat(locale, {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
  }).format(parsed);
}

export function formatListingPostedAge(postedAt, fallback = '') {
  const parsedPostedAt = toDateOrNull(postedAt);
  if (parsedPostedAt) {
    return formatShortRelativeTime(parsedPostedAt);
  }

  const fallbackText = sanitizeText(fallback);
  if (!fallbackText) return '';

  const parsedFallback = toDateOrNull(fallbackText);
  if (!parsedFallback) return fallbackText;

  return formatShortRelativeTime(parsedFallback);
}
