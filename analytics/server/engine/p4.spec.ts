import { describe, expect, it } from "vitest";
import { parseCsv, toCsv } from "./csv";
import { csvObjects, fathomRowsToRollups, umamiRowsToEvents } from "./importer";
import { sanitizeSite } from "./sites";
import { hashKey } from "./platform";
import { computeRollups } from "./rollup";

const site = sanitizeSite({ id: "kangu", domains: ["kangu.ro"], timezone: "UTC" });

describe("csv", () => {
  it("round-trips quotes, commas and newlines and neutralizes formulas", () => {
    const text = toCsv(["a", "b"], [["x,y", 'say "hi"'], ["=1+1", "line\nbreak"]]);
    expect(parseCsv(text)).toEqual([["a", "b"], ["x,y", 'say "hi"'], ["'=1+1", "line\nbreak"]]);
  });
});

describe("umami import", () => {
  it("maps website_event + session rows to raw events", () => {
    const events = csvObjects(
      "event_id,session_id,created_at,url_path,url_query,referrer_domain,referrer_path,page_title,event_type,event_name\n" +
        "1,s1,2026-10-01 10:00:00,/,utm_source=hn,news.ycombinator.com,/item,Home,1,\n" +
        "2,s1,2026-10-01 10:01:00,/pricing,,,,Pricing,1,\n" +
        "3,s1,2026-10-01 10:02:00,/pricing,,,,Pricing,2,signup\n",
    );
    const sessions = csvObjects("session_id,hostname,browser,os,device,screen,language,country,subdivision1,city\ns1,kangu.ro,chrome,Mac OS,laptop,1440x900,en-US,RO,RO-B,Bucharest\n");
    const raw = umamiRowsToEvents(site, events, sessions);
    expect(raw).toHaveLength(3);
    expect(raw[0]).toMatchObject({ t: "pv", p: "/", r: "Hacker News", ch: "social", cc: "RO", rg: "B", ci: "Bucharest", dv: "desktop", src: "umami", utm: { s: "hn" } });
    expect(raw[2]).toMatchObject({ t: "ev", n: "signup" });
    expect(new Set(raw.map((e) => e.v)).size).toBe(1);
    const day = computeRollups(raw, { timeZone: "UTC" }).get("20261001")!;
    expect(day.totals).toMatchObject({ visitors: 1, visits: 1, pageviews: 2, events: 1, bounces: 0 });
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
