/**
 * Client IP extraction, CIDR matching, and CDN geo headers.
 *
 * Forwarding headers are only as trustworthy as whoever set them. With
 * `analytics_trust_headers=auto` (default):
 *  - The "edge" address is the one that actually connected: the socket
 *    peer, or, when the peer is a local reverse proxy (loopback/private),
 *    the address that proxy reports in X-Real-IP / X-Forwarded-For.
 *  - Cloudflare's headers (CF-Connecting-IP, CF-IPCountry, region, city)
 *    are used only when that edge address is a Cloudflare one. Anyone else
 *    sending them is ignored, so visitors can't pick their IP or country.
 *  - Other CDN geo headers (CloudFront, Vercel, X-Country-Code) are ignored.
 * `cloudflare` always trusts Cloudflare's headers (for setups where another
 * proxy hides Cloudflare's address); `all` trusts every header as sent (the
 * old behaviour, for CloudFront/Vercel or a proxy that sets X-Country-Code).
 */
import { getRequestHeader, type H3Event } from "h3";

export type HeaderTrust = "auto" | "cloudflare" | "all";
export const HEADER_TRUST_MODES: HeaderTrust[] = ["auto", "cloudflare", "all"];

/** Which CDN geo headers may be read for a request. */
export type GeoHeaders = "cloudflare" | "all" | "none";

export interface ClientInfo {
  /** Best-effort visitor IP. Never stored. */
  ip: string;
  geoHeaders: GeoHeaders;
  /** Cloudflare headers were present but not trusted (possible forgery or misconfiguration). */
  ignoredCloudflareHeaders: boolean;
}

const firstForwarded = (event: H3Event): string | undefined =>
  getRequestHeader(event, "x-forwarded-for")?.split(",")[0]?.trim() || undefined;

/** Best-effort client IP with the given trust mode. Never stored. */
export const getClientIp = (event: H3Event, trust: HeaderTrust = "auto"): string => resolveClient(event, trust).ip;

const parseIpv4 = (ip: string): bigint | null => {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let value = BigInt(0);
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const n = Number(part);
    if (n > 255) return null;
    value = (value << BigInt(8)) + BigInt(n);
  }
  return value;
};

const parseIpv6 = (ip: string): bigint | null => {
  let address = ip.toLowerCase();
  const zone = address.indexOf("%");
  if (zone >= 0) address = address.slice(0, zone);
  // IPv4-mapped tail, e.g. ::ffff:1.2.3.4
  const lastColon = address.lastIndexOf(":");
  const tail = address.slice(lastColon + 1);
  if (tail.includes(".")) {
    const v4 = parseIpv4(tail);
    if (v4 === null) return null;
    const hi = Number(v4 >> BigInt(16)).toString(16);
    const lo = Number(v4 & BigInt(0xffff)).toString(16);
    address = `${address.slice(0, lastColon + 1)}${hi}:${lo}`;
  }
  const halves = address.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const rest = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - head.length - rest.length;
  if ((halves.length === 1 && missing !== 0) || missing < 0) return null;
  const groups = [...head, ...Array(halves.length === 2 ? missing : 0).fill("0"), ...rest];
  let value = BigInt(0);
  for (const group of groups) {
    if (!/^[0-9a-f]{1,4}$/.test(group)) return null;
    value = (value << BigInt(16)) + BigInt(parseInt(group, 16));
  }
  return value;
};

interface ParsedIp {
  value: bigint;
  bits: 32 | 128;
}

export const parseIp = (ip: string): ParsedIp | null => {
  const trimmed = ip.trim();
  if (trimmed.includes(":")) {
    // Normalize IPv4-mapped IPv6 to plain IPv4 so v4 rules match.
    const mapped = trimmed.toLowerCase().match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) {
      const v4 = parseIpv4(mapped[1]);
      return v4 === null ? null : { value: v4, bits: 32 };
    }
    const v6 = parseIpv6(trimmed);
    return v6 === null ? null : { value: v6, bits: 128 };
  }
  const v4 = parseIpv4(trimmed);
  return v4 === null ? null : { value: v4, bits: 32 };
};

/** Parses a comma-separated list of IPs/CIDRs. Invalid entries are skipped. */
export const parseCidrList = (value: string | null | undefined) => {
  if (!value) return [];
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [address, prefixText] = entry.split("/");
      const parsed = parseIp(address);
      if (!parsed) return null;
      const prefix = prefixText === undefined ? parsed.bits : Number(prefixText);
      if (!Number.isInteger(prefix) || prefix < 0 || prefix > parsed.bits) return null;
      return { ...parsed, prefix };
    })
    .filter((entry): entry is ParsedIp & { prefix: number } => entry !== null);
};

/** True when `ip` falls inside any of the parsed CIDRs. */
export const ipMatchesCidrs = (
  ip: string,
  cidrs: ReturnType<typeof parseCidrList>,
): boolean => {
  if (cidrs.length === 0) return false;
  const parsed = parseIp(ip);
  if (!parsed) return false;
  return cidrs.some((cidr) => {
    if (cidr.bits !== parsed.bits) return false;
    const shift = BigInt(cidr.bits - cidr.prefix);
    return parsed.value >> shift === cidr.value >> shift;
  });
};

export interface GeoInfo {
  country: string | null;
  region: string | null;
  city: string | null;
}

// Cloudflare edge ranges (https://www.cloudflare.com/ips/, checked 2026-10-28; stable for years).
const CLOUDFLARE_RANGES = parseCidrList(
  [
    "173.245.48.0/20", "103.21.244.0/22", "103.22.200.0/22", "103.31.4.0/22", "141.101.64.0/18",
    "108.162.192.0/18", "190.93.240.0/20", "188.114.96.0/20", "197.234.240.0/22", "198.41.128.0/17",
    "162.158.0.0/15", "104.16.0.0/13", "104.24.0.0/14", "172.64.0.0/13", "131.0.72.0/22",
    "2400:cb00::/32", "2606:4700::/32", "2803:f800::/32", "2405:b500::/32", "2405:8100::/32",
    "2a06:98c0::/29", "2c0f:f248::/32",
  ].join(","),
);

/** Loopback and private ranges: a peer here is a local reverse proxy. */
const LOCAL_RANGES = parseCidrList(
  "127.0.0.0/8,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16,169.254.0.0/16,100.64.0.0/10,::1/128,fc00::/7,fe80::/10",
);

const validIp = (value: string | undefined | null): string | null => {
  const trimmed = value?.trim();
  return trimmed && parseIp(trimmed) ? trimmed : null;
};

/** True for a Cloudflare edge address. */
export const isCloudflareIp = (ip: string): boolean => ipMatchesCidrs(ip, CLOUDFLARE_RANGES);

/** Resolves the visitor IP and which geo headers may be trusted (see the module comment). */
export const resolveClient = (event: H3Event, trust: HeaderTrust = "auto"): ClientInfo => {
  const cfIp = getRequestHeader(event, "cf-connecting-ip");
  if (trust === "all") {
    const ip = cfIp || getRequestHeader(event, "x-real-ip") || firstForwarded(event) || event.node?.req?.socket?.remoteAddress || "0.0.0.0";
    return { ip, geoHeaders: "all", ignoredCloudflareHeaders: false };
  }
  const peer = validIp(event.node?.req?.socket?.remoteAddress);
  let edge = peer;
  if (!peer || ipMatchesCidrs(peer, LOCAL_RANGES)) {
    // A local proxy sits in front: use the address it saw. The last
    // X-Forwarded-For entry is the one the nearest proxy appended.
    const forwarded = getRequestHeader(event, "x-forwarded-for")?.split(",");
    edge = validIp(getRequestHeader(event, "x-real-ip")) ?? validIp(forwarded?.[forwarded.length - 1]) ?? peer;
  }
  const viaCloudflare = trust === "cloudflare" || (edge !== null && isCloudflareIp(edge));
  const hasCloudflareHeaders = Boolean(cfIp || getRequestHeader(event, "cf-ipcountry"));
  return {
    ip: (viaCloudflare ? validIp(cfIp) : null) ?? edge ?? "0.0.0.0",
    geoHeaders: viaCloudflare ? "cloudflare" : "none",
    ignoredCloudflareHeaders: !viaCloudflare && hasCloudflareHeaders,
  };
};

const header = (event: H3Event, name: string): string | null => {
  const value = getRequestHeader(event, name);
  if (!value) return null;
  try {
    return decodeURIComponent(value).trim() || null;
  } catch {
    return value.trim() || null;
  }
};

/**
 * Geo from CDN headers. `cloudflare` reads only Cloudflare's; `all` also
 * reads CloudFront, Vercel and X-Country-Code. Region and city are filled
 * only when the CDN provides them.
 */
export const geoFromHeaders = (event: H3Event, which: GeoHeaders = "all"): GeoInfo => {
  if (which === "none") return { country: null, region: null, city: null };
  const all = which === "all";
  let country =
    header(event, "cf-ipcountry") ||
    (all ? header(event, "cloudfront-viewer-country") || header(event, "x-vercel-ip-country") || header(event, "x-country-code") : null);
  country = country ? country.toUpperCase().slice(0, 2) : null;
  if (!country || country === "XX" || country === "T1" || !/^[A-Z]{2}$/.test(country)) {
    country = null;
  }
  const region =
    header(event, "cf-region-code") ||
    (all ? header(event, "cloudfront-viewer-country-region") || header(event, "x-vercel-ip-country-region") : null);
  const city =
    header(event, "cf-ipcity") ||
    (all ? header(event, "cloudfront-viewer-city") || header(event, "x-vercel-ip-city") : null);
  return {
    country,
    region: country && region ? region.slice(0, 20) : null,
    city: country && city ? city.slice(0, 80) : null,
  };
};
