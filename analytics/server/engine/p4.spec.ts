import { describe, expect, it } from "vitest";
import { parseCsv, toCsv } from "./csv";
import { csvObjects, fathomRowsToRollups } from "./importer";
import { sanitizeSite } from "./sites";
import { hashKey } from "./platform";

const site = sanitizeSite({ id: "kangu", domains: ["kangu.ro"], timezone: "UTC" });

describe("csv", () => {
  it("round-trips quotes, commas and newlines and neutralizes formulas", () => {
    const text = toCsv(["a", "b"], [["x,y", 'say "hi"'], ["=1+1", "line\nbreak"]]);
    expect(parseCsv(text)).toEqual([["a", "b"], ["x,y", 'say "hi"'], ["'=1+1", "line\nbreak"]]);
  });
});

describe("fathom import", () => {
  it("aggregates hourly stats into daily rollups", () => {
    const rollups = fathomRowsToRollups(site, {
      siteStats: csvObjects("ts,pageviews,visitors,sessions,bounce_rate,avg_duration\n2026-01-05 10:00:00,10,4,5,0.4,30\n2026-01-05 11:00:00,6,2,2,0.5,10\n"),
      pageStats: csvObjects("ts,hostname,pathname,pageviews,visitors,entries,bounce_rate,avg_duration\n2026-01-05 10:00:00,https://kangu.ro,/,8,4,4,0.5,20\n"),
      referrerStats: csvObjects("ts,hostname,pathname,groupname,pageviews,visitors,bounce_rate,avg_duration\n2026-01-05 10:00:00,https://www.google.com,/,Google,3,2,0,40\n"),
    });
    const day = rollups.get("20260105")!;
    expect(day.totals).toEqual({ visitors: 6, visits: 7, pageviews: 16, bounces: 3, duration: 170, events: 0 });
    expect(day.hours[10]).toEqual({ pv: 10, v: 4, vi: 5 });
    expect(day.dims.page["/"]).toEqual({ pv: 8, v: 4 });
    expect(day.dims.entry["/"]).toMatchObject({ vi: 4, b: 2 });
    expect(day.dims.referrer.Google).toMatchObject({ v: 2, pv: 3 });
    expect(day.dims.host["kangu.ro"]).toBeTruthy();
  });
});

describe("api keys", () => {
  it("hashes keys deterministically", () => {
    expect(hashKey("cfa_x")).toHaveLength(64);
    expect(hashKey("cfa_x")).toBe(hashKey("cfa_x"));
  });
});
