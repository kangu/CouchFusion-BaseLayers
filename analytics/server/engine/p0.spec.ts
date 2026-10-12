import { describe, expect, it } from "vitest";
import { addDays, dayEnd, dayStart, daysInRange, localDay, localHour, utcMonthsInRange } from "./time";
import { isBot, parseUserAgent } from "./ua";
import { classifyChannel, parseReferrer, parseUtm } from "./referrer";
import { ipMatchesCidrs, parseCidrList } from "./net";
import { buildEngineConfig } from "./config";
import { buildRawEvent, normalizePath, sanitizeEventData } from "./hit";
import { hostAllowed, sanitizeSite } from "./sites";
import { visitorHash } from "./identity";
import { rawEventId } from "./storage";

const CHROME_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";
const SAFARI_IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

describe("time helpers", () => {
  it("computes local days and DST-safe bounds", () => {
    const ts = Date.UTC(2026, 9, 9, 22, 30); // 01:30 next day in Bucharest (UTC+3)
    expect(localDay(ts, "Europe/Bucharest")).toBe("20261010");
    expect(localDay(ts, "UTC")).toBe("20261009");
    expect(localHour(ts, "Europe/Bucharest")).toBe(1);
    expect(dayStart("20261010", "Europe/Bucharest")).toBe(Date.UTC(2026, 9, 9, 21));
    // 25-hour day when DST ends (2026-10-25 in EU).
    expect(dayEnd("20261025", "Europe/Bucharest") - dayStart("20261025", "Europe/Bucharest")).toBe(25 * 3600_000);
    expect(addDays("20261231", 1)).toBe("20270101");
    expect(daysInRange("20260228", "20260302")).toEqual(["20260228", "20260301", "20260302"]);
    expect(utcMonthsInRange(Date.UTC(2026, 10, 30), Date.UTC(2027, 0, 2))).toEqual(["2026_11", "2026_12", "2027_01"]);
  });
});

describe("user agent", () => {
  it("classifies browsers, OS, devices and bots", () => {
    expect(parseUserAgent(CHROME_MAC)).toEqual({ browser: "Chrome", os: "macOS", device: "desktop" });
    expect(parseUserAgent(SAFARI_IPHONE)).toEqual({ browser: "Safari", os: "iOS", device: "mobile" });
    expect(parseUserAgent(`${CHROME_MAC} Edg/128.0`).browser).toBe("Edge");
    expect(isBot("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)")).toBe(true);
    expect(isBot("curl/8.4.0")).toBe(true);
    expect(isBot(`${CHROME_MAC} HeadlessChrome`)).toBe(true);
    expect(isBot(CHROME_MAC)).toBe(false);
    expect(isBot("")).toBe(true);
  });
});

describe("referrer and channel", () => {
  it("groups referrers and ignores internal ones", () => {
    expect(parseReferrer("https://www.google.co.uk/search?q=x", ["kangu.ro"])).toMatchObject({ name: "Google", kind: "search" });
    expect(parseReferrer("https://kangu.ro/about", ["kangu.ro"])).toBeNull();
    expect(parseReferrer("https://www.kangu.ro/about", ["kangu.ro"])).toBeNull();
    expect(parseReferrer("https://blog.example.com/post", ["kangu.ro"])).toMatchObject({ name: "blog.example.com", path: "/post" });
    expect(parseReferrer("not a url", [])).toBeNull();
  });

  it("classifies channels", () => {
    const none = parseUtm(new URLSearchParams());
    expect(classifyChannel(null, none, false)).toBe("direct");
    expect(classifyChannel(null, none, true)).toBe("paid");
    expect(classifyChannel(parseReferrer("https://t.co/abc", []), none, false)).toBe("social");
    expect(classifyChannel(parseReferrer("https://duckduckgo.com/", []), none, false)).toBe("search");
    expect(classifyChannel(null, parseUtm(new URLSearchParams("utm_source=nl&utm_medium=email")), false)).toBe("email");
    expect(classifyChannel(parseReferrer("https://example.org", []), none, false)).toBe("referral");
  });
});

describe("cidr matching", () => {
  it("matches IPv4, IPv6 and mapped addresses", () => {
    const cidrs = parseCidrList("10.0.0.0/8, 192.168.1.5, 2001:db8::/32, bogus");
    expect(cidrs).toHaveLength(3);
    expect(ipMatchesCidrs("10.20.30.40", cidrs)).toBe(true);
    expect(ipMatchesCidrs("::ffff:10.1.1.1", cidrs)).toBe(true);
    expect(ipMatchesCidrs("192.168.1.5", cidrs)).toBe(true);
    expect(ipMatchesCidrs("192.168.1.6", cidrs)).toBe(false);
    expect(ipMatchesCidrs("2001:db8:1::1", cidrs)).toBe(true);
    expect(ipMatchesCidrs("2001:db9::1", cidrs)).toBe(false);
  });
});

describe("engine config", () => {
  it("defaults to umami_cloud and parses flat keys", () => {
    const empty = buildEngineConfig("kangu", {});
    expect(empty).toMatchObject({ mode: "umami_cloud", dbPrefix: "analytics_kangu", rawRetentionMonths: 13, respectDnt: true, maxScanDays: 31 });
    const custom = buildEngineConfig("lovable-gifts", {
      analytics_mode: "DUAL",
      analytics_respect_dnt: "false",
      analytics_raw_retention_months: "999",
      umami_excluded_paths: "/admin*, /login",
    });
    expect(custom).toMatchObject({ mode: "dual", dbPrefix: "analytics_lovable_gifts", respectDnt: false, rawRetentionMonths: 120 });
    expect(custom.excludedPaths).toEqual(["/admin*", "/login"]);
    // One website per app: the id defaults to the app slug.
    expect(empty.defaultSiteId).toBe("kangu");
    expect(custom.defaultSiteId).toBe("lovable-gifts");
    expect(buildEngineConfig("kangu", { analytics_default_site_id: "Main_Site" }).defaultSiteId).toBe("main_site");
    expect(buildEngineConfig("kangu", { analytics_default_site_id: "not valid!" }).defaultSiteId).toBe("kangu");
  });
});

describe("hit builder", () => {
  const site = sanitizeSite({ id: "kangu", domains: ["kangu.ro"], timezone: "Europe/Bucharest", excludedPaths: ["/admin*"] });
  const base = {
    site,
    config: { excludedPaths: ["/login"], persistentId: false },
    agent: { browser: "Chrome", os: "macOS", device: "desktop" as const },
    geo: { country: "RO", region: "B", city: "Bucharest" },
    visitor: "abc",
    now: Date.UTC(2026, 9, 9, 12),
    random: "deadbeef",
  };

  it("builds a pageview with UTM, referrer and stripped query", () => {
    const result = buildRawEvent({
      ...base,
      body: {
        type: "event",
        payload: {
          hostname: "www.kangu.ro",
          url: "/pricing/?utm_source=HN&utm_medium=social&secret=1",
          referrer: "https://news.ycombinator.com/item?id=1",
          title: "Pricing",
          screen: "1512x982",
          language: "ro-RO",
          website: "ignored",
        },
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.doc).toMatchObject({
      _id: rawEventId("kangu", base.now, "deadbeef"),
      t: "pv",
      p: "/pricing",
      h: "kangu.ro",
      r: "Hacker News",
      ch: "social",
      utm: { s: "hn", m: "social" },
      cc: "RO",
      lg: "ro-ro",
    });
    expect(result.doc.q).toBeUndefined();
  });

  it("builds events with sanitized data and rejects excluded/foreign hosts", () => {
    const ev = buildRawEvent({ ...base, body: { payload: { hostname: "kangu.ro", url: "/", name: "signup", data: { plan: "pro", n: 2, nested: { a: 1 } } } } });
    expect(ev.ok && ev.doc).toMatchObject({ t: "ev", n: "signup", d: { plan: "pro", n: 2, nested: '{"a":1}' } });
    expect(buildRawEvent({ ...base, body: { payload: { hostname: "kangu.ro", url: "/admin/x" } } })).toEqual({ ok: false, reason: "excluded" });
    expect(buildRawEvent({ ...base, body: { payload: { hostname: "kangu.ro", url: "/login" } } })).toEqual({ ok: false, reason: "excluded" });
    expect(buildRawEvent({ ...base, body: { payload: { hostname: "evil.com", url: "/" } } })).toEqual({ ok: false, reason: "host" });
    expect(buildRawEvent({ ...base, body: { type: "nope", payload: {} } })).toEqual({ ok: false, reason: "invalid" });
  });

  it("normalizes paths and data", () => {
    expect(normalizePath("/a/b///")).toBe("/a/b");
    expect(normalizePath("")).toBe("/");
    expect(sanitizeEventData([1, 2])).toBeNull();
    expect(Object.keys(sanitizeEventData(Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`k${i}`, i])))!)).toHaveLength(20);
  });
});

describe("sites and identity", () => {
  it("validates sites and host allow-lists", () => {
    expect(() => sanitizeSite({ id: "Bad Id" })).toThrow();
    expect(() => sanitizeSite({ id: "ok", timezone: "Mars/Base" })).toThrow();
    const site = sanitizeSite({ id: "ok", domains: "www.kangu.ro, kangu.studio" });
    expect(site.domains).toEqual(["kangu.ro", "kangu.studio"]);
    expect(hostAllowed(site, "blog.kangu.ro")).toBe(true);
    expect(hostAllowed(site, "localhost")).toBe(true);
    expect(hostAllowed(site, "kangu.ro.evil.com")).toBe(false);
  });

  it("produces stable, salt-dependent visitor hashes", () => {
    const a = visitorHash("s1", "kangu", "1.2.3.4", "ua");
    expect(a).toHaveLength(16);
    expect(visitorHash("s1", "kangu", "1.2.3.4", "ua")).toBe(a);
    expect(visitorHash("s2", "kangu", "1.2.3.4", "ua")).not.toBe(a);
  });
});
