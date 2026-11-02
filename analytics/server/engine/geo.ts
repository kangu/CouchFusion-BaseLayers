/**
 * Visitor country resolution. Order depends on `analytics_geo_source`:
 *  - header:   CDN country headers only (which ones are trusted: see net.ts)
 *  - timezone: the browser's IANA time zone only
 *  - auto:     CDN header when present, otherwise the time zone (default)
 *  - none:     no geo
 * The time zone gives a country only; region and city come from headers.
 * No IP lookup and no third party: the zone name is already in the payload.
 */
import type { H3Event } from "h3";
import { geoFromHeaders, type GeoHeaders, type GeoInfo } from "./net";
import { TZ_COUNTRY_DATA } from "./tz-country";

export type GeoSource = "header" | "timezone" | "auto" | "none";
export const GEO_SOURCES: GeoSource[] = ["auto", "header", "timezone", "none"];

let zones: Map<string, string> | null = null;

const zoneTable = (): Map<string, string> => {
  if (!zones) {
    zones = new Map();
    for (const group of TZ_COUNTRY_DATA.split(";")) {
      const [country, names] = group.split(":");
      for (const name of names.split("|")) zones.set(name, country);
    }
  }
  return zones;
};

/**
 * Country for an IANA zone name, or null. The value comes from the client,
 * so only exact names in the generated table count (an allowlist).
 */
export const countryFromTimezone = (timeZone: unknown): string | null =>
  typeof timeZone === "string" && timeZone.length <= 64 ? zoneTable().get(timeZone) ?? null : null;

const NO_GEO: GeoInfo = { country: null, region: null, city: null };

/** Resolves geo for a hit and says where the country came from. */
export const resolveGeo = (
  event: H3Event,
  timeZone: unknown,
  source: GeoSource,
  /** Which CDN headers are trustworthy for this request (from `resolveClient`). */
  headers: GeoHeaders,
): GeoInfo & { via: "header" | "timezone" | null } => {
  if (source === "none") return { ...NO_GEO, via: null };
  if (source !== "timezone") {
    const fromHeader = geoFromHeaders(event, headers);
    if (fromHeader.country || source === "header") {
      return { ...fromHeader, via: fromHeader.country ? "header" : null };
    }
  }
  const country = countryFromTimezone(timeZone);
  return { country, region: null, city: null, via: country ? "timezone" : null };
};
