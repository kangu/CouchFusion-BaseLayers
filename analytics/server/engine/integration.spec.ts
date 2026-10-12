/**
 * Opt-in integration test against a real CouchDB:
 *   ANALYTICS_IT=1 COUCHDB_ADMIN_AUTH=... npx vitest run --config layers/vitest.config.ts analytics/server/engine/integration
 * Uses a throwaway `analytics_it_<random>` prefix and deletes it afterwards.
 */
import { afterAll, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { buildEngineConfig } from "./config";
import { dropDatabase, listDatabases } from "./couch";
import { enqueueRawEvent, flushRawEvents } from "./queue";
import { ensureAppSite, invalidateSites, sanitizeSite, saveSite } from "./sites";
import { ensureMainDb, rawEventId } from "./storage";
import { getDailySalt } from "./identity";
import { aggregateSite, rebuildRange, resetSiteData, resetAggregatorCaches } from "./aggregator";
import { getMetrics, getOverview, getRealtime } from "./query";
import { localDay } from "./time";
import type { RawEvent } from "./types";

const enabled = process.env.ANALYTICS_IT === "1" && Boolean(process.env.COUCHDB_ADMIN_AUTH);
const prefix = `analytics_it_${randomBytes(3).toString("hex")}`;
const config = buildEngineConfig("it", { analytics_mode: "self_hosted", analytics_db_prefix: prefix, analytics_default_site_id: "it" });

describe.skipIf(!enabled)("engine integration (CouchDB)", () => {
  afterAll(async () => {
    for (const db of await listDatabases(prefix)) await dropDatabase(db);
  });

  it("auto-creates the app's single website", async () => {
    invalidateSites();
    const created = await ensureAppSite(config);
    expect(created).toMatchObject({ id: "it", domains: [], excludedPaths: ["/admin*", "/login"], enabled: true });
    expect((await ensureAppSite(config))._rev).toBe(created._rev);
  });

  it("stores, aggregates, queries and resets", async () => {
    await ensureMainDb(config);
    const site = await saveSite(config, sanitizeSite({ domains: ["example.test"], timezone: "UTC" }, await ensureAppSite(config, { fresh: true })));
    const salt1 = await getDailySalt(config, "20261009");
    expect(await getDailySalt(config, "20261009")).toBe(salt1);

    const now = Date.now();
    const mk = (i: number, over: Partial<RawEvent>): RawEvent => ({
      _id: rawEventId("it", now - 10 * 60_000 + i * 1000, `r${i}`),
      t: "pv", ts: now - 10 * 60_000 + i * 1000, v: "vis1", p: "/", h: "example.test", ch: "direct",
      br: "Firefox", os: "Linux", dv: "desktop", ...over,
    });
    enqueueRawEvent(config, mk(0, { p: "/", cc: "RO" }));
    enqueueRawEvent(config, mk(1, { p: "/docs", cc: "RO" }));
    enqueueRawEvent(config, mk(2, { t: "ev", n: "download", d: { file: "a.pdf" }, cc: "RO" }));
    enqueueRawEvent(config, mk(3, { v: "vis2", p: "/docs", r: "Google", rd: "google.com", ch: "search", cc: "DE" }));
    await flushRawEvents();

    resetAggregatorCaches();
    const written = await aggregateSite(config, site, now);
    expect(written).toContain(localDay(now, "UTC"));

    const overview = await getOverview(config, site, { range: "today", compare: "1" });
    expect(overview.totals).toMatchObject({ visitors: 2, visits: 2, pageviews: 3, events: 1, bounces: 1 });
    expect(overview.previous?.totals.visits).toBe(0);

    const pages = await getMetrics(config, site, "page", { range: "today" });
    expect(pages.rows[0]).toMatchObject({ value: "/docs", v: 2, pv: 2 });

    const filtered = await getOverview(config, site, { range: "today", filters: JSON.stringify([{ dim: "country", value: "DE" }]) });
    expect(filtered.totals).toMatchObject({ visitors: 1, pageviews: 1 });

    const realtime = await getRealtime(config, site, now);
    expect(realtime).toMatchObject({ visitors: 2, pageviews: 3, events: 1 });

    const rebuilt = await rebuildRange(config, site, localDay(now, "UTC"), localDay(now, "UTC"));
    expect(rebuilt.days).toBe(1);

    const reset = await resetSiteData(config, site);
    expect(reset.deleted).toBeGreaterThanOrEqual(5);
    const empty = await getOverview(config, site, { range: "today" });
    expect(empty.totals.pageviews).toBe(0);
  }, 30_000);
});
