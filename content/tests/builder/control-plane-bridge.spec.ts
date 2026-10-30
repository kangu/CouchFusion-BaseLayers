import { describe, expect, it, vi } from "vitest";
import {
  BRIDGE_REQUEST_TIMEOUT_MS,
  createControlPlaneBridge,
  narrowToParentOrigin,
  parseControlPlaneOrigins,
  type BridgeHostWindow,
  type BridgeTargetWindow,
} from "../../app/composables/useControlPlaneBridge";

const CONTROL = "https://hetzner1.tailb7471b.ts.net:9180";
const TUNNEL = "http://localhost:9180";

interface Sent {
  message: any;
  targetOrigin: string;
}

const createHarness = (overrides: { framed?: boolean; opener?: boolean; confirm?: boolean } = {}) => {
  const sent: Sent[] = [];
  const parent: BridgeTargetWindow = {
    postMessage: (message, targetOrigin) => {
      sent.push({ message, targetOrigin });
    },
  };
  const listeners = new Set<(event: MessageEvent) => void>();
  const reload = vi.fn();
  const confirm = vi.fn(() => overrides.confirm ?? false);
  const host = {
    postMessage: () => {},
    parent: null as BridgeTargetWindow | null,
    opener: null as BridgeTargetWindow | null,
    location: { pathname: "/k/", search: "", reload },
    addEventListener: (_type: "message", listener: (event: MessageEvent) => void) => listeners.add(listener),
    removeEventListener: (_type: "message", listener: (event: MessageEvent) => void) => listeners.delete(listener),
    confirm,
  } satisfies BridgeHostWindow;
  host.parent = overrides.framed === false ? (host as BridgeTargetWindow) : parent;
  if (overrides.opener) {
    host.opener = parent;
  }

  const timers: Array<{ callback: () => void; ms: number; cleared: boolean }> = [];
  let counter = 0;
  const bridge = createControlPlaneBridge({
    dev: true,
    origins: [CONTROL, TUNNEL],
    app: "radustanciu",
    host,
    randomId: () => `id-${++counter}`,
    setTimer: (callback, ms) => {
      const timer = { callback, ms, cleared: false };
      timers.push(timer);
      return timer;
    },
    clearTimer: (handle) => {
      (handle as { cleared: boolean }).cleared = true;
    },
  });

  const deliver = (data: unknown, origin = CONTROL, source: unknown = parent) => {
    for (const listener of Array.from(listeners)) {
      listener({ data, origin, source } as MessageEvent);
    }
  };
  const welcome = (nonce = "n-1", origin = CONTROL) =>
    deliver({ cf: 1, type: "cf:host.welcome", id: "p-1", payload: { nonce, capabilities: ["component.delete", "component.create", "reload", "bogus"] } }, origin);

  return { bridge, sent, deliver, welcome, reload, confirm, timers, listeners, parent };
};

describe("parseControlPlaneOrigins", () => {
  it("splits, normalizes and drops invalid entries", () => {
    expect(parseControlPlaneOrigins(`${CONTROL}/, ${TUNNEL} ,ftp://x, nope,`)).toEqual([CONTROL, TUNNEL]);
    expect(parseControlPlaneOrigins("")).toEqual([]);
    expect(parseControlPlaneOrigins(undefined)).toEqual([]);
  });
});

describe("narrowToParentOrigin", () => {
  it("keeps only the framing parent when it is configured", () => {
    const win = { location: { ancestorOrigins: [CONTROL] } };
    expect(narrowToParentOrigin([CONTROL, TUNNEL], win)).toEqual([CONTROL]);
  });
  it("keeps the full list without ancestorOrigins, unframed, or for an unknown parent", () => {
    expect(narrowToParentOrigin([CONTROL, TUNNEL], { location: {} })).toEqual([CONTROL, TUNNEL]);
    expect(narrowToParentOrigin([CONTROL, TUNNEL], { location: { ancestorOrigins: [] } })).toEqual([CONTROL, TUNNEL]);
    expect(narrowToParentOrigin([CONTROL, TUNNEL], { location: { ancestorOrigins: ["https://evil.example"] } })).toEqual([CONTROL, TUNNEL]);
    expect(narrowToParentOrigin([CONTROL], null)).toEqual([CONTROL]);
  });
});

describe("control-plane bridge (child)", () => {
  it("stays inert outside dev, without origins, or when not framed/opened", () => {
    const notDev = createControlPlaneBridge({ dev: false, origins: [CONTROL], app: "a", host: createHarness().listeners as any });
    expect(notDev.isEligible()).toBe(false);

    const noOrigins = createControlPlaneBridge({ dev: true, origins: [], app: "a", host: null });
    expect(noOrigins.isEligible()).toBe(false);

    const topLevel = createHarness({ framed: false });
    expect(topLevel.bridge.isEligible()).toBe(false);
    topLevel.bridge.start({ builder: true });
    expect(topLevel.sent).toHaveLength(0);
    expect(topLevel.listeners.size).toBe(0);

    const opened = createHarness({ framed: false, opener: true });
    expect(opened.bridge.isEligible()).toBe(true);
  });

  it("announces ready to every configured origin until welcome, then pins origin and nonce", () => {
    const h = createHarness();
    h.bridge.start({ builder: true });
    expect(h.sent.map((entry) => entry.targetOrigin)).toEqual([CONTROL, TUNNEL]);
    expect(h.sent[0].message).toMatchObject({ cf: 1, type: "cf:host.ready", payload: { app: "radustanciu", route: "/k/", builder: true, dirty: false } });
    expect(h.sent[0].message.nonce).toBeUndefined();
    expect(h.bridge.connected.value).toBe(false);

    h.welcome("n-1", TUNNEL);
    expect(h.bridge.connected.value).toBe(true);
    expect(h.bridge.capabilities.value).toEqual(["component.delete", "component.create", "reload"]);
    expect(h.timers[0].cleared).toBe(true);

    h.sent.length = 0;
    void h.bridge.requestDelete("network-hero");
    expect(h.sent).toHaveLength(1);
    expect(h.sent[0].targetOrigin).toBe(TUNNEL);
    expect(h.sent[0].message).toMatchObject({ type: "cf:host.component.delete.request", nonce: "n-1", payload: { componentId: "network-hero" } });
  });

  it("ignores messages from other sources, origins, bad envelopes and wrong nonces", () => {
    const h = createHarness();
    h.bridge.start();
    h.deliver({ cf: 1, type: "cf:host.welcome", id: "x", payload: { nonce: "n" } }, "https://evil.example");
    h.deliver({ cf: 1, type: "cf:host.welcome", id: "x", payload: { nonce: "n" } }, CONTROL, {});
    h.deliver({ cf: 2, type: "cf:host.welcome", id: "x", payload: { nonce: "n" } });
    h.deliver({ cf: 1, type: "cf:host.welcome", id: "x", payload: {} });
    expect(h.bridge.connected.value).toBe(false);

    h.welcome("n-1");
    h.deliver({ cf: 1, type: "cf:host.component.focus", id: "f", nonce: "wrong", payload: { componentId: "a" } });
    h.deliver({ cf: 1, type: "cf:host.component.focus", id: "f", nonce: "n-1", payload: { componentId: "a" } }, TUNNEL);
    expect(h.bridge.focusComponentId.value).toBeNull();
    h.deliver({ cf: 1, type: "cf:host.component.focus", id: "f", nonce: "n-1", payload: { componentId: "a" } });
    expect(h.bridge.focusComponentId.value).toBe("a");
    h.bridge.clearFocus();
    expect(h.bridge.focusComponentId.value).toBeNull();
  });

  it("resolves requests with the parent's result and times out after 120 s", async () => {
    const h = createHarness();
    h.bridge.start();
    expect(await h.bridge.requestCreate("x")).toEqual({ status: "failed", message: "Not connected to the control plane." });

    h.welcome();
    h.sent.length = 0;
    const pending = h.bridge.requestCreate("  a hero with a video  ");
    const requestId = h.sent[0].message.id;
    expect(h.sent[0].message.payload).toEqual({ promptHint: "a hero with a video" });
    h.deliver({ cf: 1, type: "cf:host.request.result", id: "r", nonce: "n-1", replyTo: requestId, payload: { status: "accepted", componentId: "hero-video" } });
    expect(await pending).toEqual({ status: "accepted", componentId: "hero-video" });

    const slow = h.bridge.requestDelete("old");
    const timeout = h.timers.at(-1)!;
    expect(timeout.ms).toBe(BRIDGE_REQUEST_TIMEOUT_MS);
    timeout.callback();
    expect((await slow).status).toBe("failed");
  });

  it("truncates prompt hints to 2 KB", () => {
    const h = createHarness();
    h.bridge.start();
    h.welcome();
    h.sent.length = 0;
    void h.bridge.requestCreate("é".repeat(3000));
    expect(new TextEncoder().encode(h.sent[0].message.payload.promptHint).length).toBeLessThanOrEqual(2048);
  });

  it("reports dirty state and defers reloads while dirty", async () => {
    const h = createHarness({ confirm: false });
    h.bridge.start();
    h.bridge.setDirty(true);
    h.welcome();
    expect(h.sent.at(-1)!.message).toMatchObject({ type: "cf:host.dirty", payload: { dirty: true } });

    h.deliver({ cf: 1, type: "cf:host.reload.request", id: "rl-1", nonce: "n-1", payload: { reason: "component.deleted" } });
    await Promise.resolve();
    await Promise.resolve();
    expect(h.confirm).toHaveBeenCalledTimes(1);
    expect(h.reload).not.toHaveBeenCalled();
    expect(h.sent.at(-1)!.message).toMatchObject({ type: "cf:host.reload.ack", replyTo: "rl-1", payload: { reloading: false, reason: "unsaved" } });

    h.bridge.setDirty(false);
    h.deliver({ cf: 1, type: "cf:host.reload.request", id: "rl-2", nonce: "n-1", payload: { reason: "component.generated", focusComponentId: "hero" } });
    await Promise.resolve();
    await Promise.resolve();
    expect(h.reload).toHaveBeenCalledTimes(1);
    expect(h.sent.at(-1)!.message).toMatchObject({ type: "cf:host.reload.ack", payload: { reloading: true } });
  });

  it("uses a registered reload handler", async () => {
    const h = createHarness();
    h.bridge.start();
    h.welcome();
    const handler = vi.fn(() => true);
    const off = h.bridge.onReloadRequest(handler);
    h.bridge.setDirty(true);
    h.deliver({ cf: 1, type: "cf:host.reload.request", id: "rl", nonce: "n-1", payload: { reason: "r", focusComponentId: "c" } });
    await Promise.resolve();
    await Promise.resolve();
    expect(handler).toHaveBeenCalledWith({ reason: "r", focusComponentId: "c", dirty: true });
    expect(h.reload).toHaveBeenCalledTimes(1);
    off();
  });

  it("stop() cancels pending requests and disconnects", async () => {
    const h = createHarness();
    h.bridge.start();
    h.welcome();
    const pending = h.bridge.requestDelete("x");
    h.bridge.stop();
    expect((await pending).status).toBe("cancelled");
    expect(h.bridge.connected.value).toBe(false);
    expect(h.listeners.size).toBe(0);
  });
});
