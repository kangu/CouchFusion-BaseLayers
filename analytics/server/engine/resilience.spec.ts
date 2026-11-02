import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEvent } from "h3";
import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";

const couchMock = vi.hoisted(() => ({
  couch: vi.fn(),
  bulk: vi.fn(),
  ensureDatabase: vi.fn(),
  forgetDatabase: vi.fn(),
  collectRange: vi.fn(),
}));

vi.mock("./couch", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./couch")>()),
  ...couchMock,
}));

const runtime = { public: { appSlug: "kangu" } };

const fresh = async <T>(path: string): Promise<T> => {
  vi.resetModules();
  return (await import(path)) as T;
};

beforeEach(() => {
  for (const fn of Object.values(couchMock)) fn.mockReset();
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("engine config", () => {
  it("reads the whole section and marks it loaded", async () => {
    couchMock.couch.mockResolvedValue({ analytics_raw_retention_months: "36", analytics_db_prefix: "custom" });
    const { resolveEngineConfig } = await fresh<typeof import("./config")>("./config");
    const config = await resolveEngineConfig(runtime);
    expect(config).toMatchObject({ loaded: true, rawRetentionMonths: 36, dbPrefix: "custom" });
    expect(couchMock.couch.mock.calls[0][0]).toBe("_node/_local/_config/cf_env_kangu");
  });

  it("treats a missing section as empty, not as a failure", async () => {
    couchMock.couch.mockResolvedValue(null);
    const { resolveEngineConfig } = await fresh<typeof import("./config")>("./config");
    expect(await resolveEngineConfig(runtime)).toMatchObject({ loaded: true, dbPrefix: "analytics_kangu" });
  });

  it("is marked not loaded when CouchDB can't be read before any success", async () => {
    const { CouchError } = await import("./couch");
    couchMock.couch.mockRejectedValue(new CouchError(503, "unreachable", "ECONNREFUSED"));
    const { resolveEngineConfig } = await fresh<typeof import("./config")>("./config");
    expect(await resolveEngineConfig(runtime)).toMatchObject({ loaded: false });
  });

  it("keeps the last good settings when a later read fails", async () => {
    vi.useFakeTimers();
    const { CouchError } = await import("./couch");
    couchMock.couch.mockResolvedValueOnce({ analytics_raw_retention_months: "36" });
    const { resolveEngineConfig, resetEngineConfigCache } = await fresh<typeof import("./config")>("./config");
    expect((await resolveEngineConfig(runtime)).rawRetentionMonths).toBe(36);
    couchMock.couch.mockRejectedValue(new CouchError(504, "timeout", "slow"));
    resetEngineConfigCache();
    const during = await resolveEngineConfig(runtime);
    expect(during).toMatchObject({ loaded: true, rawRetentionMonths: 36 });
    // Retries a few seconds later instead of caching the failure for a minute.
    couchMock.couch.mockResolvedValue({ analytics_raw_retention_months: "24" });
    vi.advanceTimersByTime(6_000);
    expect((await resolveEngineConfig(runtime)).rawRetentionMonths).toBe(24);
  });

  it("retention never runs on settings that didn't load", async () => {
    const { buildEngineConfig } = await import("./config");
    const { applyRetention } = await fresh<typeof import("./aggregator")>("./aggregator");
    expect(await applyRetention(buildEngineConfig("kangu", {}, false))).toEqual([]);
    expect(couchMock.couch).not.toHaveBeenCalled();
  });
});

describe("raw reads", () => {
  it("handles more events than fit in one spread call", async () => {
    const docs = Array.from({ length: 150_000 }, (_, i) => ({ _id: `kangu:${i}`, ts: i }));
    couchMock.collectRange.mockResolvedValue(docs);
    const { buildEngineConfig } = await import("./config");
    const { readRawEvents } = await fresh<typeof import("./storage")>("./storage");
    const start = Date.UTC(2026, 9, 1);
    const events = await readRawEvents(buildEngineConfig("kangu", {}), "kangu", start, start + 3600_000);
    expect(events).toHaveLength(150_000);
  });
});

describe("write queue", () => {
  const event = (i: number, ts = Date.UTC(2026, 9, 28, 10) + i) => ({ _id: `kangu:${ts}:${i}`, t: "pv", ts, v: "x", p: "/" }) as any;

  it("puts a failed batch back and writes it on the next flush", async () => {
    const { CouchError } = await import("./couch");
    const { buildEngineConfig } = await import("./config");
    const queue = await fresh<typeof import("./queue")>("./queue");
    const config = buildEngineConfig("kangu", {});
    couchMock.bulk.mockRejectedValueOnce(new CouchError(503, "unreachable", "down"));
    queue.enqueueRawEvent(config, event(1));
    queue.enqueueRawEvent(config, event(2));
    await queue.flushRawEvents();
    expect(queue.pendingRawEvents()).toBe(2);
    expect(queue.rawWritesFailing()).toBe(true);
    expect(queue.oldestPendingTs()).toBe(event(1).ts);

    // Second attempt: one doc had already landed (conflict) — counted as written, not duplicated.
    couchMock.bulk.mockResolvedValueOnce([{ id: "a", rev: "1-x" }, { id: "b", error: "conflict" }]);
    await queue.flushRawEvents();
    expect(queue.pendingRawEvents()).toBe(0);
    expect(queue.rawWritesFailing()).toBe(false);
    expect(queue.queueStats).toMatchObject({ written: 2, dropped: 0, retried: 2 });
    expect(couchMock.bulk.mock.calls[1][1].map((d: any) => d._id)).toEqual([event(1)._id, event(2)._id]);
  });

  it("forgets a database that returned 404 so it is re-created", async () => {
    const { CouchError } = await import("./couch");
    const { buildEngineConfig } = await import("./config");
    const queue = await fresh<typeof import("./queue")>("./queue");
    couchMock.bulk.mockRejectedValueOnce(new CouchError(404, "not_found", "Database does not exist."));
    queue.enqueueRawEvent(buildEngineConfig("kangu", {}), event(1));
    await queue.flushRawEvents();
    expect(couchMock.forgetDatabase).toHaveBeenCalledWith("analytics_kangu_raw_2026_10");
    expect(queue.pendingRawEvents()).toBe(1);
  });

  it("drops per-doc rejections instead of retrying them forever", async () => {
    const { buildEngineConfig } = await import("./config");
    const queue = await fresh<typeof import("./queue")>("./queue");
    couchMock.bulk.mockResolvedValueOnce([{ id: "a", error: "doc_validation", reason: "bad" }]);
    queue.enqueueRawEvent(buildEngineConfig("kangu", {}), event(1));
    await queue.flushRawEvents();
    expect(queue.pendingRawEvents()).toBe(0);
    expect(queue.queueStats.dropped).toBe(1);
  });
});

describe("collector", () => {
  it("doesn't store hits while settings are unreadable", async () => {
    const { buildEngineConfig } = await import("./config");
    const { collectHit } = await fresh<typeof import("./collector")>("./collector");
    const socket = new Socket();
    const req = new IncomingMessage(socket);
    req.headers = { "user-agent": "Mozilla/5.0 (Macintosh) Safari/605.1.15" };
    const ev = createEvent(req, new ServerResponse(req));
    expect(await collectHit(ev, { payload: { url: "/" } }, buildEngineConfig("kangu", {}, false))).toBe("unavailable");
    expect(couchMock.couch).not.toHaveBeenCalled();
    socket.destroy();
  });
});

describe("body limit", () => {
  const post = (body: string, headers: Record<string, string> = {}) => {
    const socket = new Socket();
    const req = new IncomingMessage(socket);
    req.method = "POST";
    req.headers = { "content-type": "application/json", ...headers };
    (req as any).body = body;
    const event = createEvent(req, new ServerResponse(req));
    return { event, socket };
  };

  it("rejects a declared length over the limit without reading", async () => {
    const { readLimitedBody } = await import("./body");
    const { event, socket } = post("{}", { "content-length": "999999" });
    await expect(readLimitedBody(event, 1024)).rejects.toMatchObject({ statusCode: 413 });
    socket.destroy();
  });

  it("rejects a body that grows past the limit while streaming", async () => {
    const { readLimitedBody } = await import("./body");
    const { event, socket } = post(JSON.stringify({ x: "a".repeat(5000) }));
    await expect(readLimitedBody(event, 1024)).rejects.toMatchObject({ statusCode: 413 });
    socket.destroy();
  });

  it("parses JSON and passes text through", async () => {
    const { readLimitedBody } = await import("./body");
    const a = post('{"payload":{"url":"/"}}');
    expect(await readLimitedBody(a.event, 1024)).toEqual({ payload: { url: "/" } });
    const b = post("not json");
    expect(await readLimitedBody(b.event, 1024)).toBe("not json");
    a.socket.destroy();
    b.socket.destroy();
  });
});
