const DEFAULT_TIMESTAMP_KEYS = ['updatedAt', 'createdAt'];

function parseTimestampValue(value) {
  if (!value) {
    return { timestamp: 0, hasTimestamp: false, date: null };
  }

  if (value instanceof Date) {
    const millis = value.getTime();
    if (Number.isNaN(millis)) {
      return { timestamp: 0, hasTimestamp: false, date: null };
    }
    return { timestamp: millis, hasTimestamp: true, date: value };
  }

  if (typeof value?.toDate === 'function') {
    const convertedDate = value.toDate();
    return parseTimestampValue(convertedDate);
  }

  if (typeof value?.seconds === 'number') {
    const millis = value.seconds * 1000;
    return { timestamp: millis, hasTimestamp: true, date: new Date(millis) };
  }

  if (typeof value?._seconds === 'number') {
    const millis = value._seconds * 1000;
    return { timestamp: millis, hasTimestamp: true, date: new Date(millis) };
  }

  const parsed = new Date(value);
  const parsedMillis = parsed.getTime();
  if (Number.isNaN(parsedMillis)) {
    return { timestamp: 0, hasTimestamp: false, date: null };
  }

  return { timestamp: parsedMillis, hasTimestamp: true, date: parsed };
}

function getComparableIdValue(item) {
  const id = item?.id;
  if (typeof id === 'number') return id;
  if (typeof id === 'string') {
    const numeric = Number(id);
    if (Number.isFinite(numeric)) return numeric;
    return id;
  }
  return '';
}

export function getCanonicalTimestamp(entity, fallbackKeys = []) {
  const keys = [...DEFAULT_TIMESTAMP_KEYS, ...fallbackKeys];
  for (const key of keys) {
    const candidate = parseTimestampValue(entity?.[key]);
    if (candidate.hasTimestamp) {
      return candidate;
    }
  }
  return { timestamp: 0, hasTimestamp: false, date: null };
}

export function sortEntitiesNewestFirst(entities = [], options = {}) {
  const { fallbackKeys = [] } = options;
  return [...entities]
    .map((entity, index) => ({
      entity,
      index,
      ts: getCanonicalTimestamp(entity, fallbackKeys),
      comparableId: getComparableIdValue(entity),
    }))
    .sort((a, b) => {
      if (a.ts.timestamp !== b.ts.timestamp) {
        return b.ts.timestamp - a.ts.timestamp;
      }
      if (a.comparableId !== b.comparableId) {
        if (typeof a.comparableId === 'number' && typeof b.comparableId === 'number') {
          return b.comparableId - a.comparableId;
        }
        return String(b.comparableId).localeCompare(String(a.comparableId));
      }
      return a.index - b.index;
    })
    .map((item) => item.entity);
}

export function sortEntitiesOldestFirst(entities = [], options = {}) {
  const { fallbackKeys = [] } = options;
  return [...entities]
    .map((entity, index) => ({
      entity,
      index,
      ts: getCanonicalTimestamp(entity, fallbackKeys),
      comparableId: getComparableIdValue(entity),
    }))
    .sort((a, b) => {
      if (a.ts.timestamp !== b.ts.timestamp) {
        return a.ts.timestamp - b.ts.timestamp;
      }
      if (a.comparableId !== b.comparableId) {
        if (typeof a.comparableId === 'number' && typeof b.comparableId === 'number') {
          return a.comparableId - b.comparableId;
        }
        return String(a.comparableId).localeCompare(String(b.comparableId));
      }
      return a.index - b.index;
    })
    .map((item) => item.entity);
}

export function dedupeAndSortNewest(existing = [], incoming = [], options = {}) {
  const byId = new Map();
  [...existing, ...incoming].forEach((item) => {
    if (!item?.id) return;
    byId.set(item.id, item);
  });
  return sortEntitiesNewestFirst(Array.from(byId.values()), options);
}

export function parseTimestampSafely(value) {
  return parseTimestampValue(value);
}

