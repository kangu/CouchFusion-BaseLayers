/**
 * Dependency-free user-agent classification. Only coarse buckets are kept
 * (browser family, OS family, device type) -- the raw UA is never stored.
 */

export interface ParsedUserAgent {
  browser: string;
  os: string;
  device: "desktop" | "mobile" | "tablet";
}

const BOT_PATTERN =
  /bot\b|bot\/|crawl|spider|slurp|bingpreview|facebookexternalhit|facebookcatalog|embedly|quora link preview|outbrain|pinterest\/0\.|vkshare|w3c_validator|whatsapp|telegram|discord|skypeuripreview|headless|phantomjs|puppeteer|playwright|selenium|lighthouse|pagespeed|gtmetrix|pingdom|uptimerobot|statuscake|site24x7|curl\/|wget\/|python-requests|python-urllib|aiohttp|httpclient|axios\/|node-fetch|undici|go-http-client|java\/|okhttp|libwww|scrapy|semrush|ahrefs|mj12|dotbot|petalbot|bytespider|gptbot|chatgpt|claudebot|claude-web|anthropic-ai|ccbot|perplexity|amazonbot|applebot|yandex(bot|images)|baiduspider|duckduckbot|sogou|exabot|ia_archiver|archive\.org/i;

/** True when the user agent belongs to a crawler, preview fetcher, or script. */
export const isBot = (userAgent: string | null | undefined): boolean => {
  if (!userAgent || userAgent.length < 10) return true;
  return BOT_PATTERN.test(userAgent);
};

const detectBrowser = (ua: string): string => {
  if (/Edg(e|A|iOS)?\//.test(ua)) return "Edge";
  if (/OPR\/|OPT\/|Opera/.test(ua)) return "Opera";
  if (/SamsungBrowser\//.test(ua)) return "Samsung Internet";
  if (/YaBrowser\//.test(ua)) return "Yandex";
  if (/Vivaldi\//.test(ua)) return "Vivaldi";
  if (/DuckDuckGo\//.test(ua)) return "DuckDuckGo";
  if (/Firefox\/|FxiOS\//.test(ua)) return "Firefox";
  if (/CriOS\//.test(ua)) return "Chrome";
  if (/Chrome\/|Chromium\//.test(ua)) return "Chrome";
  if (/MSIE |Trident\//.test(ua)) return "Internet Explorer";
  if (/Version\/[\d.]+.*Safari\//.test(ua) || /AppleWebKit\/.*Mobile\//.test(ua)) {
    return "Safari";
  }
  return "Other";
};

const detectOs = (ua: string): string => {
  if (/Windows NT|Windows Phone/.test(ua)) return "Windows";
  if (/iPad/.test(ua)) return "iPadOS";
  if (/iPhone|iPod/.test(ua)) return "iOS";
  if (/Android/.test(ua)) return "Android";
  if (/CrOS/.test(ua)) return "ChromeOS";
  if (/Mac OS X|Macintosh/.test(ua)) return "macOS";
  if (/Linux|X11/.test(ua)) return "Linux";
  return "Other";
};

const detectDevice = (ua: string, os: string): ParsedUserAgent["device"] => {
  if (os === "iPadOS" || /Tablet|Kindle|Silk\//.test(ua)) return "tablet";
  if (os === "Android" && !/Mobile/.test(ua)) return "tablet";
  if (/Mobi|iPhone|iPod|Windows Phone/.test(ua)) return "mobile";
  return "desktop";
};

/** Classifies a user agent into browser / OS / device buckets. */
export const parseUserAgent = (userAgent: string | null | undefined): ParsedUserAgent => {
  const ua = userAgent || "";
  const os = detectOs(ua);
  return { browser: detectBrowser(ua), os, device: detectDevice(ua, os) };
};
