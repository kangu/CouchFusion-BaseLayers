import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEvent } from "h3";
import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";

const { resolveUmamiConfigMock } = vi.hoisted(() => ({
  resolveUmamiConfigMock: vi.fn(),
}));

vi.mock("../utils/umami-config", () => ({
  resolveUmamiConfig: resolveUmamiConfigMock,
}));

const createPostEvent = (body: Record<string, any>) => {
  const socket = new Socket();
  const req = new IncomingMessage(socket);
  req.method = "POST";
  req.url = "/api/stats";
  req.headers = {
    "content-type": "application/json",
    "user-agent": "analytics-test",
  };
  req.body = JSON.stringify(body);

  const res = new ServerResponse(req);
  res.on("finish", () => socket.destroy());
  res.on("close", () => socket.destroy());

  const event = createEvent(req, res);
  event.context = {};
  return { event, socket };
};

describe("analytics stats proxy", () => {
  beforeEach(() => {
    resolveUmamiConfigMock.mockReset();
    vi.stubGlobal("useRuntimeConfig", () => ({
      analytics: {
        umami: {
          proxyHost: "https://cloud.umami.is",
        },
      },
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("overwrites a client-supplied website with the CouchDB website ID", async () => {
    resolveUmamiConfigMock.mockResolvedValue({
      excludedPaths: [],
      websiteId: "couch-website",
    });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue("ok"),
    });
    vi.stubGlobal("fetch", fetchMock);
    const handler = (await import("./stats.post")).default;
    const { event, socket } = createPostEvent({
      payload: {
        pathname: "/pricing",
        website: "client-selected-website",
      },
    });

    await expect(handler(event)).resolves.toEqual({ ok: true });

    const request = fetchMock.mock.calls[0]?.[1];
    expect(JSON.parse(String(request?.body))).toMatchObject({
      payload: {
        pathname: "/pricing",
        website: "couch-website",
      },
    });
    socket.destroy();
  });

  it("filters requests using exclusions resolved from CouchDB", async () => {
    resolveUmamiConfigMock.mockResolvedValue({
      excludedPaths: ["/admin/*", "/login"],
      websiteId: "couch-website",
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const handler = (await import("./stats.post")).default;
    const { event, socket } = createPostEvent({
      payload: {
        pathname: "/admin/orders",
      },
    });

    await expect(handler(event)).resolves.toEqual({ ok: true });
    expect(fetchMock).not.toHaveBeenCalled();
    socket.destroy();
  });
});
