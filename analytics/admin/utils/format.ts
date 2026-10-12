/**
 * Formatting helpers for the analytics admin UI.
 */

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
const full = new Intl.NumberFormat("en");

/** 1234 -> "1.2K" (exact below 10 000). */
export const formatNumber = (value: number | null | undefined): string => {
  const n = Number(value ?? 0);
  return Math.abs(n) < 10_000 ? full.format(Math.round(n * 100) / 100) : compact.format(n);
};

/** Seconds -> "1m 05s". */
export const formatDuration = (seconds: number | null | undefined): string => {
  const s = Math.max(0, Math.round(Number(seconds ?? 0)));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, "0")}s`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
};

export const formatPercent = (value: number | null | undefined): string =>
  `${Math.round(Number(value ?? 0) * 10) / 10}%`;

/** Relative change in percent, or null when not computable. */
export const changePercent = (current: number, previous: number | undefined): number | null => {
  if (previous === undefined || previous === null) return null;
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
};

export const formatMoney = (amount: number, currency: string): string => {
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
};

let regionNames: Intl.DisplayNames | null = null;
let languageNames: Intl.DisplayNames | null = null;

export const countryName = (code: string): string => {
  if (!/^[A-Z]{2}$/.test(code)) return code;
  try {
    regionNames ??= new Intl.DisplayNames(["en"], { type: "region" });
    return regionNames.of(code) ?? code;
  } catch {
    return code;
  }
};

export const languageName = (code: string): string => {
  try {
    languageNames ??= new Intl.DisplayNames(["en"], { type: "language" });
    return languageNames.of(code) ?? code;
  } catch {
    return code;
  }
};

/** Regional-indicator flag emoji for an ISO country code. */
export const flagEmoji = (code: string): string =>
  /^[A-Z]{2}$/.test(code)
    ? String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))
    : "🏳️";

export const DIMENSION_LABELS: Record<string, string> = {
  page: "Page",
  title: "Title",
  host: "Hostname",
  entry: "Entry page",
  exit: "Exit page",
  referrer: "Referrer",
  referrer_domain: "Referrer domain",
  channel: "Channel",
  utm_source: "UTM source",
  utm_medium: "UTM medium",
  utm_campaign: "UTM campaign",
  utm_term: "UTM term",
  utm_content: "UTM content",
  browser: "Browser",
  os: "OS",
  device: "Device",
  screen: "Screen",
  language: "Language",
  country: "Country",
  region: "Region",
  city: "City",
  tag: "Tag",
  event: "Event",
  prop: "Property",
};

const CHANNEL_LABELS: Record<string, string> = {
  direct: "Direct",
  search: "Organic search",
  social: "Social",
  email: "Email",
  paid: "Paid",
  referral: "Referral",
};

/** Human label for a dimension value. */
export const formatDimValue = (dim: string, value: string): string => {
  if (value === "(other)") return "Other";
  switch (dim) {
    case "country":
      return `${flagEmoji(value)} ${countryName(value)}`;
    case "region": {
      const [cc, ...rest] = value.split("-");
      return `${flagEmoji(cc)} ${rest.join("-")} (${cc})`;
    }
    case "city": {
      const cc = value.slice(-2);
      return `${flagEmoji(cc)} ${value}`;
    }
    case "language":
      return languageName(value);
    case "channel":
      return CHANNEL_LABELS[value] ?? value;
    case "device":
      return value.charAt(0).toUpperCase() + value.slice(1);
    case "prop": {
      const [, key, val] = value.split("\u001f");
      return `${key} = ${val}`;
    }
    default:
      return value;
  }
};
