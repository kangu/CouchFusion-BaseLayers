import { describe, expect, it } from "vitest";
import { createEvent } from "h3";
import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";
import { buildEngineConfig } from "./config";
import { countryFromTimezone, resolveGeo } from "./geo";
import { TRACKER_SCRIPT } from "./tracker-script";

const request = (headers: Record<string, string> = {}) => {
  const req = new IncomingMessage(new Socket());
  req.headers = headers;
  return createEvent(req, new ServerResponse(req));
};

describe("time zone -> country", () => {
  it("maps canonical, per-country and legacy names", () => {
    expect(countryFromTimezone("Europe/Bucharest")).toBe("RO");
    expect(countryFromTimezone("Europe/Oslo")).toBe("NO"); // shares Berlin's clock, still Norway
    expect(countryFromTimezone("Europe/Berlin")).toBe("DE");
    expect(countryFromTimezone("Asia/Calcutta")).toBe("IN"); // what V8 reports
    expect(countryFromTimezone("Asia/Kolkata")).toBe("IN");
    expect(countryFromTimezone("Europe/Kiev")).toBe("UA");
    expect(countryFromTimezone("US/Pacific")).toBe("US");
    expect(countryFromTimezone("America/Coral_Harbour")).toBe("CA"); // links to Panama, but is Canada
  });

  it("gives no country for non-geographic or spoofed zones", () => {
    for (const zone of ["UTC", "Etc/UTC", "Etc/GMT+2", "GMT", "CET", "EST", "EST5EDT", "Atlantic/Reykjavik"]) {
      expect(countryFromTimezone(zone)).toBeNull();
    }
  });

  it("treats the client value as untrusted", () => {
    for (const value of ["__proto__", "constructor", "toString", "europe/bucharest", "Europe/Bucharest ", "x".repeat(200), 42, null, {}]) {
      expect(countryFromTimezone(value)).toBeNull();
    }
  });

  it("covers every zone this runtime can report", () => {
    const missing = Intl.supportedValuesOf("timeZone").filter((zone) => !countryFromTimezone(zone));
    // Only the anti-fingerprinting zone and non-geographic names are allowed to miss.
    expect(missing.filter((zone) => !/^(Atlantic\/Reykjavik|UTC|Etc\/.*)$/.test(zone))).toEqual([]);
  });
});

describe("geo source", () => {
  it("defaults to auto and parses the setting", () => {
    expect(buildEngineConfig("kangu", {}).geoSource).toBe("auto");
    expect(buildEngineConfig("kangu", { analytics_geo_source: "HEADER" }).geoSource).toBe("header");
    expect(buildEngineConfig("kangu", { analytics_geo_source: "timezone" }).geoSource).toBe("timezone");
    expect(buildEngineConfig("kangu", { analytics_geo_source: "none" }).geoSource).toBe("none");
    expect(buildEngineConfig("kangu", { analytics_geo_source: "bogus" }).geoSource).toBe("auto");
  });

  it("auto prefers the CDN header, with its region and city", () => {
    const event = request({ "cf-ipcountry": "de", "cf-region-code": "BE", "cf-ipcity": "Berlin" });
    expect(resolveGeo(event, "Europe/Bucharest", "auto", "cloudflare")).toEqual({ country: "DE", region: "BE", city: "Berlin", via: "header" });
  });

  it("auto falls back to the time zone, country only", () => {
    expect(resolveGeo(request(), "Europe/Bucharest", "auto", "cloudflare")).toEqual({ country: "RO", region: null, city: null, via: "timezone" });
    expect(resolveGeo(request({ "cf-ipcountry": "XX" }), "Europe/Bucharest", "auto", "cloudflare").via).toBe("timezone");
  });

  it("header, timezone and none only use their own source", () => {
    expect(resolveGeo(request(), "Europe/Bucharest", "header", "cloudflare").country).toBeNull();
    expect(resolveGeo(request({ "cf-ipcountry": "DE" }), "Europe/Bucharest", "timezone", "cloudflare").country).toBe("RO");
    expect(resolveGeo(request({ "cf-ipcountry": "DE" }), "Europe/Bucharest", "none", "cloudflare").country).toBeNull();
  });

  it("ignores untrusted CDN headers and falls back to the time zone", () => {
    expect(resolveGeo(request({ "cf-ipcountry": "US" }), "Europe/Bucharest", "auto", "none")).toMatchObject({ country: "RO", via: "timezone" });
    // CloudFront/Vercel/X-Country-Code only count with trust "all".
    expect(resolveGeo(request({ "x-country-code": "US" }), "Europe/Bucharest", "auto", "cloudflare").country).toBe("RO");
    expect(resolveGeo(request({ "x-country-code": "US" }), "Europe/Bucharest", "auto", "all").country).toBe("US");
  });

  it("the standalone tracker sends the time zone", () => {
    expect(TRACKER_SCRIPT).toContain("resolvedOptions().timeZone");
    expect(TRACKER_SCRIPT).toContain("timezone: tz");
  });
});
