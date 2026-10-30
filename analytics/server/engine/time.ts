/**
 * Timezone-aware day helpers. Days are `YYYYMMDD` strings in a site's IANA
 * timezone; timestamps are epoch milliseconds.
 */

const formatterCache = new Map<string, Intl.DateTimeFormat>();

const getFormatter = (timeZone: string): Intl.DateTimeFormat => {
  let formatter = formatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatterCache.set(timeZone, formatter);
  }
  return formatter;
};

/** Returns true when `timeZone` is a valid IANA zone. */
export const isValidTimeZone = (timeZone: unknown): timeZone is string => {
  if (typeof timeZone !== "string" || !timeZone) return false;
  try {
    getFormatter(timeZone);
    return true;
  } catch {
    return false;
  }
};

interface LocalParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/** Splits a timestamp into wall-clock parts in `timeZone`. */
export const localParts = (ts: number, timeZone: string): LocalParts => {
  const parts: Record<string, number> = {};
  for (const part of getFormatter(timeZone).formatToParts(new Date(ts))) {
    if (part.type !== "literal") parts[part.type] = Number(part.value);
  }
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour === 24 ? 0 : parts.hour,
    minute: parts.minute,
    second: parts.second,
  };
};

/** Offset of `timeZone` from UTC at `ts`, in milliseconds. */
export const timeZoneOffset = (ts: number, timeZone: string): number => {
  const p = localParts(ts, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(ts / 1000) * 1000;
};

const pad = (value: number, size = 2) => String(value).padStart(size, "0");

/**
 * UTC offsets cached per zone and 15-minute UTC bucket. Every current IANA
 * offset change lands on a 15-minute UTC boundary (including :30/:45 zones),
 * so one Intl call per bucket is exact. This keeps `Intl.formatToParts` off
 * the per-event hot path of rollups and reports. Bounded: cleared past
 * MAX_CACHED_OFFSETS entries.
 */
const OFFSET_BUCKET_MS = 15 * 60_000;
const MAX_CACHED_OFFSETS = 50_000;
const offsetCache = new Map<string, Map<number, number>>();
let cachedOffsets = 0;

const cachedOffset = (ts: number, timeZone: string): number => {
  const bucket = Math.floor(ts / OFFSET_BUCKET_MS);
  let zone = offsetCache.get(timeZone);
  const hit = zone?.get(bucket);
  if (hit !== undefined) return hit;
  if (cachedOffsets >= MAX_CACHED_OFFSETS) {
    offsetCache.clear();
    cachedOffsets = 0;
    zone = undefined;
  }
  if (!zone) {
    zone = new Map();
    offsetCache.set(timeZone, zone);
  }
  const offset = timeZoneOffset(bucket * OFFSET_BUCKET_MS, timeZone);
  zone.set(bucket, offset);
  cachedOffsets += 1;
  return offset;
};

/** Local `YYYYMMDD` for a timestamp. */
export const localDay = (ts: number, timeZone: string): string => {
  const local = new Date(ts + cachedOffset(ts, timeZone));
  return `${local.getUTCFullYear()}${pad(local.getUTCMonth() + 1)}${pad(local.getUTCDate())}`;
};

/** Local hour (0-23) for a timestamp. */
export const localHour = (ts: number, timeZone: string): number =>
  new Date(ts + cachedOffset(ts, timeZone)).getUTCHours();

export const parseDay = (day: string) => ({
  year: Number(day.slice(0, 4)),
  month: Number(day.slice(4, 6)),
  day: Number(day.slice(6, 8)),
});

export const isDayString = (value: unknown): value is string =>
  typeof value === "string" && /^\d{8}$/.test(value);

/** Adds `count` calendar days to a `YYYYMMDD` string. */
export const addDays = (day: string, count: number): string => {
  const { year, month, day: d } = parseDay(day);
  const date = new Date(Date.UTC(year, month - 1, d + count));
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}`;
};

/** Epoch ms of local midnight starting `day` in `timeZone`. */
export const dayStart = (day: string, timeZone: string): number => {
  const { year, month, day: d } = parseDay(day);
  const guess = Date.UTC(year, month - 1, d);
  let start = guess - timeZoneOffset(guess, timeZone);
  // Re-evaluate once so DST transitions around midnight resolve correctly.
  start = guess - timeZoneOffset(start, timeZone);
  return start;
};

/** Epoch ms of the local midnight that ends `day` (exclusive). */
export const dayEnd = (day: string, timeZone: string): number =>
  dayStart(addDays(day, 1), timeZone);

/** Inclusive list of days from `from` to `to`. */
export const daysInRange = (from: string, to: string, max = 3660): string[] => {
  const days: string[] = [];
  let cursor = from;
  while (cursor <= to && days.length < max) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return days;
};

/** `YYYY-MM-DD` for display. */
export const formatDay = (day: string): string =>
  `${day.slice(0, 4)}-${day.slice(4, 6)}-${day.slice(6, 8)}`;

/** Parses `YYYY-MM-DD` or `YYYYMMDD` into `YYYYMMDD`. */
export const normalizeDayInput = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const compact = value.replace(/-/g, "");
  return isDayString(compact) ? compact : null;
};

/** UTC `YYYY_MM` month key for raw-event database sharding. */
export const utcMonthKey = (ts: number): string => {
  const date = new Date(ts);
  return `${date.getUTCFullYear()}_${pad(date.getUTCMonth() + 1)}`;
};

/** Inclusive list of UTC month keys covering `[fromTs, toTs]`. */
export const utcMonthsInRange = (fromTs: number, toTs: number): string[] => {
  const months: string[] = [];
  const start = new Date(fromTs);
  let year = start.getUTCFullYear();
  let month = start.getUTCMonth();
  const end = new Date(toTs);
  const endKey = end.getUTCFullYear() * 12 + end.getUTCMonth();
  while (year * 12 + month <= endKey && months.length < 240) {
    months.push(`${year}_${pad(month + 1)}`);
    month += 1;
    if (month === 12) {
      month = 0;
      year += 1;
    }
  }
  return months;
};
