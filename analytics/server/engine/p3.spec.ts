import { describe, expect, it } from "vitest";
import { buildVisits } from "./rollup";
import { resolveRange } from "./query";
import {
  attributionReport,
  breakdownReport,
  funnelReport,
  goalsReport,
  journeyReport,
  retentionReport,
  revenueReport,
  sessionList,
  stepMatches,
  utmReport,
  type ReportInput,
} from "./reports";
import type { RawEvent } from "./types";

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 9, 1, 10);
let n = 0;
const ev = (over: Partial<RawEvent>): RawEvent => ({
  _id: `s:${n++}`, t: "pv", ts: T0, v: "aaaaaaaaaaaaaaaa", p: "/", h: "x.test", ch: "direct", br: "Chrome", os: "macOS", dv: "desktop", ...over,
});

const events: RawEvent[] = [
  // a: search visit, home -> pricing -> signup (EUR 10), identified
  ev({ v: "aaaaaaaaaaaaaaaa", ts: T0, p: "/", ch: "search", r: "Google", uid: "u1", utm: { s: "google", m: "cpc", c: "fall", t: null, ct: null } }),
  ev({ v: "aaaaaaaaaaaaaaaa", ts: T0 + 60_000, p: "/pricing", uid: "u1" }),
  ev({ v: "aaaaaaaaaaaaaaaa", ts: T0 + 120_000, t: "ev", n: "signup", d: { revenue: 10, currency: "EUR" }, uid: "u1" }),
  // b: direct visit, home -> pricing (no signup)
  ev({ v: "bbbbbbbbbbbbbbbb", ts: T0 + 5_000, p: "/" }),
  ev({ v: "bbbbbbbbbbbbbbbb", ts: T0 + 65_000, p: "/pricing" }),
  // u1 returns two days later (new daily visitor hash), direct
  ev({ v: "cccccccccccccccc", ts: T0 + 2 * DAY, p: "/", uid: "u1" }),
];

const input: ReportInput = {
  range: resolveRange({ from: "2026-10-01", to: "2026-10-05" }, "UTC", T0),
  filters: [],
  visits: buildVisits(events),
  timeZone: "UTC",
};

describe("reports", () => {
  it("matches steps with prefixes", () => {
    expect(stepMatches(ev({ p: "/blog/a" }), { type: "path", value: "/blog/*" })).toBe(true);
    expect(stepMatches(ev({ t: "ev", n: "x" }), { type: "event", value: "x" })).toBe(true);
  });

  it("computes goals and funnels", () => {
    const goals = goalsReport(input, [{ id: "g", name: "Signup", type: "event", value: "signup" }]);
    expect(goals.goals[0]).toMatchObject({ visitors: 1, count: 1, conversionRate: 33.3 });
    const funnel = funnelReport(input, [{ type: "path", value: "/" }, { type: "path", value: "/pricing" }, { type: "event", value: "signup" }]);
    expect(funnel.steps.map((s) => s.visitors)).toEqual([3, 2, 1]);
    expect(funnel.steps[2]).toMatchObject({ conversionRate: 33.3, dropoff: 1, dropoffRate: 50 });
  });

  it("computes journeys", () => {
    const journeys = journeyReport(input, 3);
    expect(journeys.journeys).toContainEqual({ path: ["/", "/pricing"], visits: 1, visitors: 1 });
    expect(journeys.journeys).toContainEqual({ path: ["/", "/pricing", "⚡ signup"], visits: 1, visitors: 1 });
    expect(journeyReport(input, 5, null, { type: "event", value: "signup" }).journeys).toEqual([
      { path: ["/", "/pricing", "⚡ signup"], visits: 1, visitors: 1 },
    ]);
  });

  it("computes retention from identities", () => {
    const retention = retentionReport(input, 3);
    expect(retention.identifiedVisitors).toBe(1);
    expect(retention.cohorts[0]).toEqual({ day: "2026-10-01", size: 1, retention: [100, 0, 100, 0] });
  });

  it("computes utm, revenue, attribution, breakdown, sessions", () => {
    expect(utmReport(input).rows[0]).toMatchObject({ key: ["google", "cpc", "fall", "", ""], visits: 1 });
    const revenue = revenueReport(input);
    expect(revenue.totals).toEqual([{ currency: "EUR", amount: 10, count: 1, visitors: 1, average: 10 }]);
    expect(revenue.byChannel).toEqual([{ value: "search", amount: 10 }]);
    const attribution = attributionReport(input, { type: "event", value: "signup" }, "first");
    expect(attribution).toMatchObject({ conversions: 1, channel: [{ value: "search", conversions: 1, revenue: 10 }] });
    expect(breakdownReport(input, ["channel", "device"]).rows[0]).toMatchObject({ key: ["direct", "desktop"], visits: 2 });
    const sessions = sessionList(input);
    expect(sessions.total).toBe(3);
    expect(sessions.sessions[0]).toMatchObject({ identity: "u:u1", entry: "/" });
  });
});
