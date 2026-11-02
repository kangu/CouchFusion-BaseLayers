import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEvent } from "h3";
import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";

const { collectHitMock } = vi.hoisted(() => ({ collectHitMock: vi.fn() }));

vi.mock("../engine/collector", () => ({ collectHit: collectHitMock }));
vi.mock("../engine/cors", () => ({ applyCollectCors: vi.fn() }));
vi.mock("../engine/config", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../engine/config")>()),
  resolveEngineConfig: vi.fn().mockResolvedValue({ slug: "test" }),
}));

const createPostEvent = (body: unknown) => {
  const socket = new Socket();
  const req = new IncomingMessage(socket);
  req.method = "POST";
  req.url = "/api/stats";
  req.headers = {
    "content-type": "application/json",
    "user-agent": "analytics-test",
  };
  (req as any).body = typeof body === "string" ? body : JSON.stringify(body);

  const res = new ServerResponse(req);
  res.on("finish", () => socket.destroy());
  res.on("close", () => socket.destroy());

  const event = createEvent(req, res);
  event.context = {};
  return { event, socket };
};

describe("analytics stats endpoint", () => {
  beforeEach(() => {
    collectHitMock.mockReset();
    vi.stubGlobal("useRuntimeConfig", () => ({}));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("stores every hit locally without any _config keys", async () => {
    collectHitMock.mockResolvedValue("stored");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const handler = (await import("./stats.post")).default;
    const { event, socket } = createPostEvent({ type: "event", payload: { pathname: "/pricing" } });

    await expect(handler(event)).resolves.toEqual({ ok: true });
    expect(collectHitMock).toHaveBeenCalledTimes(1);
    expect(collectHitMock.mock.calls[0]?.[1]).toMatchObject({ payload: { pathname: "/pricing" } });
    // Nothing leaves the server.
    expect(fetchMock).not.toHaveBeenCalled();
    socket.destroy();
  });

  it("still answers ok when local collection throws", async () => {
    collectHitMock.mockRejectedValue(new Error("couch down"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const handler = (await import("./stats.post")).default;
    const { event, socket } = createPostEvent({ payload: { pathname: "/" } });

    await expect(handler(event)).resolves.toEqual({ ok: true });
    socket.destroy();
  });

  it("rejects a body without a payload object", async () => {
    const handler = (await import("./stats.post")).default;
    const { event, socket } = createPostEvent({ type: "event" });

    await expect(handler(event)).rejects.toMatchObject({ statusCode: 400 });
    expect(collectHitMock).not.toHaveBeenCalled();
    socket.destroy();
  });
});
