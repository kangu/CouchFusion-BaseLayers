/**
 * Client IP extraction, CIDR matching, and CDN geo headers.
 */
import { getRequestHeader, type H3Event } from "h3";

/** Best-effort client IP (Cloudflare / common proxies / socket). Never stored. */
export const getClientIp = (event: H3Event): string => {
  const cf = getRequestHeader(event, "cf-connecting-ip");
  const real = getRequestHeader(event, "x-real-ip");
  const xff = getRequestHeader(event, "x-forwarded-for");
  const first = xff ? xff.split(",")[0]?.trim() : undefined;
  return cf || real || first || event.node?.req?.socket?.remoteAddress || "0.0.0.0";
};

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
 * Geo from CDN headers (Cloudflare, CloudFront, Vercel). Region and city are
 * filled only when the CDN provides them.
 */
export const geoFromHeaders = (event: H3Event): GeoInfo => {
  let country =
    header(event, "cf-ipcountry") ||
    header(event, "cloudfront-viewer-country") ||
    header(event, "x-vercel-ip-country") ||
    header(event, "x-country-code");
  country = country ? country.toUpperCase().slice(0, 2) : null;
  if (!country || country === "XX" || country === "T1" || !/^[A-Z]{2}$/.test(country)) {
    country = null;
  }
  const region =
    header(event, "cf-region-code") ||
    header(event, "cloudfront-viewer-country-region") ||
    header(event, "x-vercel-ip-country-region");
  const city =
    header(event, "cf-ipcity") ||
    header(event, "cloudfront-viewer-city") ||
    header(event, "x-vercel-ip-city");
  return {
    country,
    region: country && region ? region.slice(0, 20) : null,
    city: country && city ? city.slice(0, 80) : null,
  };
};
