import { describe, expect, it } from "vitest";
import { buildVisits, capDimension, computeRollups, mergeRollups } from "./rollup";
import { buildSeries, parseFilters, previousRange, resolveRange, toRows } from "./query";
import type { RawEvent } from "./types";

const T0 = Date.UTC(2026, 9, 9, 8, 0); // 11:00 Bucharest
const MIN = 60_000;
let seq = 0;
const ev = (over: Partial<RawEvent>): RawEvent => ({
  _id: `kangu:${String(over.ts ?? T0).padStart(13, "0")}:${(seq++).toString(16)}`,
  t: "pv",
  ts: T0,
  v: "a",
  p: "/",
  h: "kangu.ro",
  ch: "direct",
  br: "Chrome",
  os: "macOS",
  dv: "desktop",
  ...over,
});

const events: RawEvent[] = [
  // Visitor a: 2 visits (gap > 30 min). First visit: / -> /pricing -> signup event.
  ev({ v: "a", ts: T0, p: "/", r: "Google", rd: "google.com", ch: "search", cc: "RO" }),
  ev({ v: "a", ts: T0 + 2 * MIN, p: "/pricing", r: "Google", ch: "search", cc: "RO" }),
  ev({ v: "a", ts: T0 + 3 * MIN, t: "ev", n: "signup", d: { plan: "pro", revenue: 49, currency: "eur" }, cc: "RO" }),
  ev({ v: "a", ts: T0 + 60 * MIN, p: "/blog", cc: "RO" }),
  // Visitor b: single bounce from HN on mobile.
  ev({ v: "b", ts: T0 + 5 * MIN, p: "/pricing", r: "Hacker News", ch: "social", dv: "mobile", cc: "US" }),
  // Identify-only noise is not a visit.
  ev({ v: "c", ts: T0 + 6 * MIN, t: "id", uid: "user-1" }),
];

describe("visits", () => {
  it("splits on 30-minute gaps and ignores identify-only visits", () => {
    const visits = buildVisits(events);
    expect(visits).toHaveLength(3);
    expect(visits.map((v) => v.visitor)).toEqual(["a", "b", "a"]);
    expect(visits[0].pageviews).toHaveLength(2);
    expect(visits[0].customs).toHaveLength(1);
  });
});

describe("rollups", () => {
  const day = computeRollups(events, { timeZone: "Europe/Bucharest" }).get("20261009")!;

  it("computes Fathom/Umami core totals", () => {
    expect(day.totals).toEqual({ visitors: 2, visits: 3, pageviews: 4, bounces: 2, duration: 180, events: 1 });
    expect(day.hours[11]).toEqual({ pv: 3, v: 2, vi: 2 });
    expect(day.hours[12]).toEqual({ pv: 1, v: 1, vi: 1 });
    expect(day.revenue).toEqual({ EUR: 49 });
  });

  it("computes dimensions", () => {
    expect(day.dims.page["/pricing"]).toEqual({ pv: 2, v: 2 });
    expect(day.dims.entry["/"]).toMatchObject({ vi: 1, v: 1, pv: 2, d: 180 });
    expect(day.dims.exit["/pricing"]).toMatchObject({ vi: 2 });
    expect(day.dims.referrer).toEqual({ Google: { v: 1, vi: 1, pv: 2, d: 180 }, "Hacker News": { v: 1, vi: 1, pv: 1, b: 1 } });
    expect(day.dims.channel.direct).toMatchObject({ vi: 1, b: 1 });
    expect(day.dims.event.signup).toEqual({ v: 1, c: 1 });
    expect(day.dims.prop["signup\u001fplan\u001fpro"]).toEqual({ v: 1, c: 1 });
    expect(day.dims.device).toMatchObject({ desktop: { vi: 2 }, mobile: { vi: 1 } });
  });

  it("applies visit- and page-level filters", () => {
    const us = computeRollups(events, { timeZone: "Europe/Bucharest", filters: [{ dim: "country", op: "eq", value: "us" }] }).get("20261009")!;
    expect(us.totals).toMatchObject({ visitors: 1, visits: 1, pageviews: 1 });
    const pricing = computeRollups(events, { timeZone: "Europe/Bucharest", filters: [{ dim: "page", op: "eq", value: "/pricing" }] }).get("20261009")!;
    expect(pricing.totals).toMatchObject({ visits: 2, pageviews: 2, visitors: 2 });
    expect(Object.keys(pricing.dims.page)).toEqual(["/pricing"]);
    const signup = computeRollups(events, { timeZone: "Europe/Bucharest", filters: [{ dim: "event", op: "eq", value: "signup" }] }).get("20261009")!;
    expect(signup.totals.visits).toBe(1);
  });

  it("assigns visits to their local start day", () => {
    const late = [ev({ v: "z", ts: Date.UTC(2026, 9, 9, 20, 50) }), ev({ v: "z", ts: Date.UTC(2026, 9, 9, 21, 10) })];
    const result = computeRollups(late, { timeZone: "Europe/Bucharest" });
    expect([...result.keys()]).toEqual(["20261009"]);
    expect(result.get("20261009")!.totals.pageviews).toBe(2);
  });

  it("caps dimensions and merges days", () => {
    const capped = capDimension(Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`/p${i}`, { pv: i, v: i }])), 4);
    expect(Object.keys(capped)).toHaveLength(4);
    expect(capped["(other)"]).toEqual({ pv: 0 + 1 + 2 + 3 + 4 + 5 + 6, v: 21 });
    const merged = mergeRollups([day, day]);
    expect(merged.totals.visitors).toBe(4);
    expect(merged.dims.page["/pricing"]).toEqual({ pv: 4, v: 4 });
    expect(toRows(merged.dims.referrer)[0]).toMatchObject({ value: "Google", bounceRate: 0, avgDuration: 180 });
  });
});

describe("ranges", () => {
  const now = Date.UTC(2026, 9, 9, 12);
  it("resolves presets in the site timezone", () => {
    expect(resolveRange({ range: "7d" }, "UTC", now)).toMatchObject({ from: "20261003", to: "20261009", grain: "day" });
    expect(resolveRange({ range: "today" }, "UTC", now)).toMatchObject({ grain: "hour" });
    expect(resolveRange({ range: "last_month" }, "UTC", now)).toMatchObject({ from: "20260901", to: "20260930" });
    expect(resolveRange({ from: "2026-10-05", to: "2026-10-01" }, "UTC", now)).toMatchObject({ from: "20261001", to: "20261005" });
    expect(resolveRange({ range: "12m" }, "UTC", now).grain).toBe("month");
    expect(resolveRange({ range: "24h" }, "UTC", now).window).toEqual([now - 86400000, now + 1]);
    const r = resolveRange({ range: "7d" }, "UTC", now);
    expect(previousRange(r, "UTC")).toMatchObject({ from: "20260926", to: "20261002" });
  });

  it("builds zero-filled series and parses filters", () => {
    const range = resolveRange({ range: "7d" }, "UTC", now);
    const series = buildSeries([{ day: "20261009", totals: { visitors: 2, visits: 3, pageviews: 4, bounces: 0, duration: 0, events: 0 }, hours: [], dims: {}, revenue: {} }], range, "UTC");
    expect(series).toHaveLength(7);
    expect(series[6]).toEqual({ t: "2026-10-09", pageviews: 4, visitors: 2, visits: 3 });
    expect(parseFilters('[{"dim":"country","value":"RO"},{"dim":"nope","value":"x"}]')).toEqual([{ dim: "country", op: "eq", value: "RO" }]);
  });
});
