/**
 * Referrer grouping, UTM extraction, and channel classification.
 */

export type Channel = "direct" | "search" | "social" | "email" | "paid" | "referral";

export interface UtmParams {
  s: string | null;
  m: string | null;
  c: string | null;
  t: string | null;
  ct: string | null;
}

interface ReferrerGroup {
  name: string;
  kind: "search" | "social" | "email" | null;
  pattern: RegExp;
}

// Matched against the hostname without a leading `www.`.
const GROUPS: ReferrerGroup[] = [
  { name: "Google", kind: "search", pattern: /(^|\.)google\.[a-z.]+$/ },
  { name: "Bing", kind: "search", pattern: /(^|\.)bing\.com$/ },
  { name: "DuckDuckGo", kind: "search", pattern: /(^|\.)duckduckgo\.com$/ },
  { name: "Yahoo", kind: "search", pattern: /(^|\.)yahoo\.[a-z.]+$/ },
  { name: "Yandex", kind: "search", pattern: /(^|\.)yandex\.[a-z.]+$/ },
  { name: "Baidu", kind: "search", pattern: /(^|\.)baidu\.com$/ },
  { name: "Ecosia", kind: "search", pattern: /(^|\.)ecosia\.org$/ },
  { name: "Brave Search", kind: "search", pattern: /^search\.brave\.com$/ },
  { name: "Startpage", kind: "search", pattern: /(^|\.)startpage\.com$/ },
  { name: "Qwant", kind: "search", pattern: /(^|\.)qwant\.com$/ },
  { name: "Kagi", kind: "search", pattern: /(^|\.)kagi\.com$/ },
  { name: "Perplexity", kind: "search", pattern: /(^|\.)perplexity\.ai$/ },
  { name: "ChatGPT", kind: "search", pattern: /(^|\.)chatgpt\.com$|(^|\.)chat\.openai\.com$/ },
  { name: "Gmail", kind: "email", pattern: /^mail\.google\.com$/ },
  { name: "Outlook", kind: "email", pattern: /(^|\.)outlook\.(live|office)\.com$/ },
  { name: "Yahoo Mail", kind: "email", pattern: /^mail\.yahoo\.com$/ },
  { name: "Proton Mail", kind: "email", pattern: /^mail\.proton\.me$/ },
  { name: "X (Twitter)", kind: "social", pattern: /(^|\.)(twitter\.com|x\.com|t\.co)$/ },
  { name: "Facebook", kind: "social", pattern: /(^|\.)(facebook\.com|fb\.com|fb\.me)$/ },
  { name: "Instagram", kind: "social", pattern: /(^|\.)instagram\.com$/ },
  { name: "LinkedIn", kind: "social", pattern: /(^|\.)(linkedin\.com|lnkd\.in)$/ },
  { name: "Reddit", kind: "social", pattern: /(^|\.)reddit\.com$/ },
  { name: "Hacker News", kind: "social", pattern: /^news\.ycombinator\.com$/ },
  { name: "YouTube", kind: "social", pattern: /(^|\.)(youtube\.com|youtu\.be)$/ },
  { name: "GitHub", kind: null, pattern: /(^|\.)github\.com$/ },
  { name: "Pinterest", kind: "social", pattern: /(^|\.)pinterest\.[a-z.]+$/ },
  { name: "TikTok", kind: "social", pattern: /(^|\.)tiktok\.com$/ },
  { name: "Threads", kind: "social", pattern: /(^|\.)threads\.net$/ },
  { name: "Bluesky", kind: "social", pattern: /(^|\.)bsky\.app$/ },
  { name: "Mastodon", kind: "social", pattern: /(^|\.)mastodon\.[a-z.]+$|(^|\.)mstdn\.[a-z.]+$/ },
  { name: "Telegram", kind: "social", pattern: /(^|\.)(t\.me|telegram\.org)$/ },
  { name: "WhatsApp", kind: "social", pattern: /(^|\.)whatsapp\.com$|^wa\.me$/ },
  { name: "Discord", kind: "social", pattern: /(^|\.)discord(app)?\.com$/ },
  { name: "Nostr", kind: "social", pattern: /(^|\.)(primal\.net|snort\.social|iris\.to|nostr\.com)$/ },
];

export interface ParsedReferrer {
  /** Display/grouped name, e.g. `Google` or `example.com`. */
  name: string;
  /** Bare hostname (no `www.`). */
  domain: string;
  path: string;
  kind: ReferrerGroup["kind"];
}

/** Strips `www.` and lowercases. */
export const normalizeHost = (host: string): string =>
  host.trim().toLowerCase().replace(/^www\./, "").replace(/\.$/, "");

/**
 * Parses an external referrer. Returns null for empty, invalid, or same-site
 * referrers (internal navigation is not a traffic source).
 */
export const parseReferrer = (
  referrer: unknown,
  siteHosts: string[],
): ParsedReferrer | null => {
  if (typeof referrer !== "string" || !referrer.trim()) return null;
  let url: URL;
  try {
    url = new URL(referrer.trim());
  } catch {
    return null;
  }
  if (!/^https?:$/.test(url.protocol) && url.protocol !== "android-app:") return null;
  const domain = normalizeHost(url.hostname);
  if (!domain) return null;
  if (siteHosts.some((host) => normalizeHost(host) === domain)) return null;

  const group = GROUPS.find((candidate) => candidate.pattern.test(domain));
  return {
    name: group?.name ?? domain,
    domain,
    path: url.pathname.slice(0, 200) || "/",
    kind: group?.kind ?? null,
  };
};

const pick = (params: URLSearchParams, key: string): string | null => {
  const value = params.get(key);
  return value && value.trim() ? value.trim().toLowerCase().slice(0, 100) : null;
};

/** Extracts UTM parameters. */
export const parseUtm = (params: URLSearchParams): UtmParams => ({
  s: pick(params, "utm_source") ?? pick(params, "ref") ?? pick(params, "source"),
  m: pick(params, "utm_medium"),
  c: pick(params, "utm_campaign"),
  t: pick(params, "utm_term"),
  ct: pick(params, "utm_content"),
});

const CLICK_IDS = ["gclid", "gbraid", "wbraid", "msclkid", "fbclid", "ttclid", "li_fat_id", "twclid", "dclid"];

/** True when the landing URL carries an ad-network click id. */
export const hasClickId = (params: URLSearchParams): boolean =>
  CLICK_IDS.some((key) => params.has(key));

const PAID_MEDIUM = /^(cpc|ppc|cpm|cpv|cpa|paid|paidsearch|paid_search|paid-search|paidsocial|paid_social|paid-social|display|banner|retargeting|ads?)$/;
const EMAIL_MEDIUM = /e-?mail|newsletter/;
const SOCIAL_MEDIUM = /^(social|social-network|social-media|sm|social_network|social_media)$/;

/** Classifies a visit's acquisition channel. */
export const classifyChannel = (
  referrer: ParsedReferrer | null,
  utm: UtmParams,
  clickId: boolean,
): Channel => {
  const medium = utm.m ?? "";
  const source = utm.s ?? "";
  if (clickId || PAID_MEDIUM.test(medium)) return "paid";
  if (EMAIL_MEDIUM.test(medium) || EMAIL_MEDIUM.test(source) || referrer?.kind === "email") {
    return "email";
  }
  if (SOCIAL_MEDIUM.test(medium) || referrer?.kind === "social") return "social";
  if (referrer?.kind === "search" || medium === "organic") return "search";
  if (referrer || utm.s) return "referral";
  return "direct";
};
