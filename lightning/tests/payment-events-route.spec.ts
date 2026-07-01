import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEvent } from "h3";
import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";

const getDocumentMock = vi.fn();
const getSessionMock = vi.fn();
const subscribeMock = vi.fn();

vi.mock("#database/utils/couchdb", () => ({
  getDocument: getDocumentMock,
  getSession: getSessionMock,
}));

vi.mock("../server/utils/payment-event-bus", () => ({
  paymentEventBus: {
    subscribe: subscribeMock,
  },
}));

interface CreateEventOptions {
  path?: string;
  headers?: Record<string, string>;
}

const createMockEvent = (options: CreateEventOptions = {}) => {
  const socket = new Socket();
  const req = new IncomingMessage(socket);
  req.method = "GET";
  req.url = options.path || "/api/lightning/events?invoiceId=inv_123";
  req.headers = Object.fromEntries(
    Object.entries(options.headers || {}).map(([key, value]) => [
      key.toLowerCase(),
      value,
    ]),
  );

  const res = new ServerResponse(req);
  const writes: string[] = [];
  const originalWrite = res.write.bind(res);
  res.write = ((chunk: any, ...args: any[]) => {
    writes.push(String(chunk));
    return originalWrite(chunk, ...args);
  }) as typeof res.write;

  res.on("finish", () => socket.destroy());
  res.on("close", () => socket.destroy());

  const event = createEvent(req, res);
  event.context = {};

  return { event, req, res, socket, writes };
};

describe("payment events SSE route", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    getDocumentMock.mockReset();
    getSessionMock.mockReset();
    subscribeMock.mockReset();
    subscribeMock.mockReturnValue(vi.fn());

    (globalThis as any).useRuntimeConfig = () => ({
      dbLoginPrefix: "bv-",
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("rejects unauthenticated requests", async () => {
    getSessionMock.mockResolvedValue(null);

    const handler = (await import("../server/api/lightning/events.get")).default;
    const { event } = createMockEvent();

    await expect(handler(event)).rejects.toMatchObject({
      statusCode: 401,
    });
    expect(subscribeMock).not.toHaveBeenCalled();
  });

  it("requires an invoiceId or orderId scope", async () => {
    getSessionMock.mockResolvedValue({ userCtx: { name: "alice", roles: [] } });

    const handler = (await import("../server/api/lightning/events.get")).default;
    const { event } = createMockEvent({
      path: "/api/lightning/events",
      headers: { cookie: "AuthSession=session-token" },
    });

    await expect(handler(event)).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("rejects subscriptions for another user's invoice", async () => {
    getSessionMock.mockResolvedValue({ userCtx: { name: "alice", roles: [] } });
    getDocumentMock.mockResolvedValue({
      _id: "invoice-inv_123",
      invoiceData: { invoiceId: "inv_123" },
      userName: "bob",
    });

    const handler = (await import("../server/api/lightning/events.get")).default;
    const { event } = createMockEvent({
      headers: { cookie: "AuthSession=session-token" },
    });

    await expect(handler(event)).rejects.toMatchObject({
      statusCode: 403,
    });
    expect(subscribeMock).not.toHaveBeenCalled();
  });

  it("subscribes matching invoice owners and writes the ready event", async () => {
    getSessionMock.mockResolvedValue({ userCtx: { name: "alice", roles: [] } });
    getDocumentMock.mockResolvedValue({
      _id: "invoice-inv_123",
      invoiceData: { invoiceId: "inv_123" },
      orderId: "purchase_123",
      userName: "alice",
    });

    const handler = (await import("../server/api/lightning/events.get")).default;
    const { event, writes } = createMockEvent({
      headers: { cookie: "AuthSession=session-token" },
    });

    await handler(event);

    expect(subscribeMock).toHaveBeenCalledWith(
      { invoiceId: "inv_123", orderId: "purchase_123", userName: "alice" },
      expect.any(Function),
      { replay: true },
    );
    expect(writes.join("")).toContain("event: ready");
  });

  it("unsubscribes when the request closes", async () => {
    const unsubscribe = vi.fn();
    subscribeMock.mockReturnValue(unsubscribe);
    getSessionMock.mockResolvedValue({ userCtx: { name: "alice", roles: [] } });
    getDocumentMock.mockResolvedValue({
      _id: "purchase_123",
      userName: "alice",
    });

    const handler = (await import("../server/api/lightning/events.get")).default;
    const { event, req } = createMockEvent({
      path: "/api/lightning/events?orderId=purchase_123",
      headers: { cookie: "AuthSession=session-token" },
    });

    await handler(event);
    req.emit("close");

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
