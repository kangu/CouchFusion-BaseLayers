import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  docs: new Map<string, any>(),
  rawEvents: [] as any[],
}));

const couchMock = vi.hoisted(() => ({
  getDoc: vi.fn(),
  putDoc: vi.fn(),
  upsertDoc: vi.fn(),
  bulk: vi.fn(),
  scanIds: vi.fn(),
  collectRange: vi.fn(),
  listDatabases: vi.fn(),
  dropDatabase: vi.fn(),
}));

vi.mock("./couch", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./couch")>()),
  ...couchMock,
}));

import { buildEngineConfig } from "./config";
import { sanitizeSite } from "./sites";
import { addDays, dayStart, localDay, localHour, localParts } from "./time";
import { SCAN_MARGIN_MS } from "./aggregator";
import { tsKey } from "./storage";

const config = buildEngineConfig("kangu", {});
const site = sanitizeSite({ id: "kangu", domains: [], timezone: "UTC" });

const pageview = (ts: number, i: number) => ({ _id: `kangu:${tsKey(ts)}:${i}`, t: "pv", ts, v: `v${i}`, p: "/", h: "kangu.ro", ch: "direct", br: "Chrome", os: "Mac", dv: "desktop" });

beforeEach(() => {
  vi.resetModules();
  db.docs.clear();
  db.rawEvents = [];
  for (const fn of Object.values(couchMock)) fn.mockReset();
  couchMock.getDoc.mockImplementation(async (_db: string, id: string) => db.docs.get(id) ?? null);
  couchMock.putDoc.mockImplementation(async (_db: string, doc: any) => {
    db.docs.set(doc._id, doc);
    return { ok: true, id: doc._id, rev: "1-x" };
  });
  couchMock.upsertDoc.mockImplementation(async (_db: string, id: string, mutate: any) => {
    const next = mutate(db.docs.get(id) ?? null);
    if (next) db.docs.set(id, { ...next, _id: id });
    return next;
  });
  couchMock.collectRange.mockImplementation(async (_db: string, start: string, end: string) =>
    db.rawEvents.filter((e) => e._id >= start && e._id <= end),
  );
  couchMock.listDatabases.mockResolvedValue([]);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("cached timezone offsets", () => {
  it("match Intl for day and hour across DST and :30/:45 zones", () => {
    const zones = ["Europe/Bucharest", "America/New_York", "Asia/Kathmandu", "Australia/Lord_Howe", "Pacific/Chatham", "UTC"];
    for (const zone of zones) {
      for (let ts = Date.UTC(2026, 0, 1); ts < Date.UTC(2027, 0, 1); ts += 3 * 3600_000 + 7 * 60_000 + 11_000) {
        const p = localParts(ts, zone);
        expect(localHour(ts, zone)).toBe(p.hour);
        expect(localDay(ts, zone)).toBe(`${p.year}${String(p.month).padStart(2, "0")}${String(p.day).padStart(2, "0")}`);
      }
    }
  });
});

describe("rebuild", () => {
  it("leaves days whose raw shards were dropped untouched and reports them", async () => {
    // Retention already dropped everything through August 2025.
    db.docs.set("meta:retention", { _id: "meta:retention", droppedThrough: 2025 * 12 + 7 });
    db.docs.set("agg:kangu:20250830", { _id: "agg:kangu:20250830", day: "20250830", totals: { visitors: 50, visits: 60, pageviews: 90, bounces: 1, duration: 1, events: 0 }, hours: [], dims: {}, revenue: {} });
    const { rebuildRange } = await import("./aggregator");
    const result = await rebuildRange(config, site, "20250830", "20250903", Date.UTC(2025, 9, 15));
    // Aug 30 and 31 are gone; Sep 1's scan window starts on Aug 31, so it's skipped too.
    expect(result).toMatchObject({ days: 5, skipped: 3, skippedThrough: "20250901" });
    expect(db.docs.get("agg:kangu:20250830").totals.pageviews).toBe(90);
  });

  it("still zeroes a day whose raw data exists but has no events", async () => {
    db.docs.set("agg:kangu:20261020", { _id: "agg:kangu:20261020", day: "20261020", totals: { visitors: 5, visits: 5, pageviews: 5, bounces: 0, duration: 0, events: 0 }, hours: [], dims: {}, revenue: {} });
    const { rebuildRange } = await import("./aggregator");
    const result = await rebuildRange(config, site, "20261020", "20261020", Date.UTC(2026, 9, 28));
    expect(result).toMatchObject({ skipped: 0, written: 1 });
    expect(db.docs.get("agg:kangu:20261020").totals.pageviews).toBe(0);
  });
});

describe("aggregation tick", () => {
  const today = "20261028";
  const noon = Date.UTC(2026, 9, 28, 12);

  it("skips recomputing today when no new events arrived", async () => {
    db.docs.set("state:kangu", { _id: "state:kangu", finalizedThrough: addDays(today, -1) });
    db.rawEvents = [pageview(noon - 60_000, 1)];
    const { aggregateSite } = await import("./aggregator");
    expect(await aggregateSite(config, site, noon)).toEqual([today]);
    const rollupReads = () => couchMock.getDoc.mock.calls.filter((c) => c[1] === `agg:kangu:${today}`).length;
    const reads = rollupReads();
    expect(await aggregateSite(config, site, noon + 60_000)).toEqual([]);
    // Neither recomputed nor even compared against the stored doc.
    expect(rollupReads()).toBe(reads);
    // A new event makes it recompute again.
    db.rawEvents.push(pageview(noon + 90_000, 2));
    expect(await aggregateSite(config, site, noon + 120_000)).toEqual([today]);
  });

  it("recomputes yesterday every 15 minutes while it's open, not every tick", async () => {
    db.docs.set("state:kangu", { _id: "state:kangu", finalizedThrough: addDays(today, -2) });
    const yesterdayScan = `kangu:${tsKey(dayStart(addDays(today, -1), "UTC") - SCAN_MARGIN_MS)}`;
    const yesterdayReads = () => couchMock.collectRange.mock.calls.filter((c) => c[1] === yesterdayScan).length;
    const { aggregateSite } = await import("./aggregator");
    const midnight = Date.UTC(2026, 9, 28);
    await aggregateSite(config, site, midnight + 60_000);
    expect(yesterdayReads()).toBe(1);
    await aggregateSite(config, site, midnight + 2 * 60_000);
    await aggregateSite(config, site, midnight + 10 * 60_000);
    expect(yesterdayReads()).toBe(1);
    await aggregateSite(config, site, midnight + 17 * 60_000);
    expect(yesterdayReads()).toBe(2);
    // After the margin it is finalized once more.
    await aggregateSite(config, site, midnight + SCAN_MARGIN_MS + 5 * 60_000);
    expect(yesterdayReads()).toBe(3);
    expect(db.docs.get("state:kangu").finalizedThrough).toBe(addDays(today, -1));
  });

  it("drops its in-memory events after a reset on any instance", async () => {
    db.docs.set("state:kangu", { _id: "state:kangu", finalizedThrough: addDays(today, -1) });
    db.rawEvents = [pageview(noon - 60_000, 1)];
    const { aggregateSite } = await import("./aggregator");
    await aggregateSite(config, site, noon);
    expect(db.docs.get(`agg:kangu:${today}`).totals.pageviews).toBe(1);
    // Another instance deleted the raw events and wrote the marker.
    db.rawEvents = [];
    db.docs.set("reset:kangu", { _id: "reset:kangu", at: noon + 30_000 });
    await aggregateSite(config, site, noon + 60_000);
    expect(db.docs.get(`agg:kangu:${today}`).totals.pageviews).toBe(0);
  });

  it("still finalizes yesterday when today's step fails", async () => {
    db.docs.set("state:kangu", { _id: "state:kangu", finalizedThrough: addDays(today, -2) });
    const todayScan = `kangu:${tsKey(dayStart(today, "UTC") - SCAN_MARGIN_MS)}`;
    couchMock.collectRange.mockImplementation(async (_db: string, start: string) => {
      if (start === todayScan) throw new Error("boom");
      return [];
    });
    const { aggregateSite } = await import("./aggregator");
    await aggregateSite(config, site, noon);
    expect(db.docs.get("state:kangu").finalizedThrough).toBe(addDays(today, -1));
  });
});

describe("reset", () => {
  it("deletes page by page and leaves a marker", async () => {
    couchMock.listDatabases.mockResolvedValue(["kangu-analytics_raw_2026_10"]);
    const pages = [[{ id: "kangu:1", rev: "1-a" }, { id: "kangu:2", rev: "1-b" }], []];
    couchMock.scanIds.mockImplementation(async (database: string) => (database.includes("_raw_") ? pages.shift() ?? [] : []));
    couchMock.bulk.mockImplementation(async (_db: string, docs: any[]) => docs.map((d) => ({ id: d._id, rev: "2-x" })));
    const { resetSiteData } = await import("./aggregator");
    expect(await resetSiteData(config, site)).toEqual({ deleted: 2 });
    expect(couchMock.bulk.mock.calls[0][1]).toEqual([
      { _id: "kangu:1", _rev: "1-a", _deleted: true },
      { _id: "kangu:2", _rev: "1-b", _deleted: true },
    ]);
    expect(db.docs.get("reset:kangu")?.at).toBeGreaterThan(0);
  });

  it("reports failure instead of claiming success", async () => {
    couchMock.listDatabases.mockResolvedValue(["kangu-analytics_raw_2026_10"]);
    couchMock.scanIds.mockResolvedValue([{ id: "kangu:1", rev: "1-a" }]);
    couchMock.bulk.mockResolvedValue([{ id: "kangu:1", error: "forbidden" }]);
    const { resetSiteData } = await import("./aggregator");
    await expect(resetSiteData(config, site)).rejects.toThrow(/Could not delete/);
  });
});
