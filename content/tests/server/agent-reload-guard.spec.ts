import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import registerControlPlaneRoutes from "../../utils/register-control-plane-routes";
import {
  GUARD_WINDOW_MS,
  agentReloadGuardEnabled,
  agentReloadGuardPlugin,
  createAgentReloadGuard,
  isGuardedPath,
  shouldSuppress,
} from "../../utils/agent-reload-guard";

const APP = "/srv/couchfusion/workspace/apps/radustanciu";
const VUE = `${APP}/app/components/content/ZzProbe.vue`;
const REGISTRY_TS = `${APP}/app/content-builder/component-definitions.ts`;

describe("agent reload guard: path and payload rules", () => {
  it("guards content components and the generated registry only", () => {
    expect(isGuardedPath(VUE)).toBe(true);
    expect(isGuardedPath("/components/content/ZzProbe.vue")).toBe(true);
    expect(isGuardedPath(REGISTRY_TS)).toBe(true);
    expect(isGuardedPath(`${APP}/app/content-builder/component-definitions.json`)).toBe(true);
    expect(isGuardedPath(`${APP}/app/assets/css/main.css`)).toBe(false);
    expect(isGuardedPath(`${APP}/app/pages/index.vue`)).toBe(false);
    expect(isGuardedPath(undefined)).toBe(false);
  });

  it("drops the reload paths observed on hetzner1-like runs", () => {
    // full-reload triggered by the content glob on add/delete
    expect(shouldSuppress({ type: "full-reload", path: "*", triggeredBy: VUE }, false)).toBe(true);
    // plugin-vue's file-changed for the registry and the component
    expect(shouldSuppress({ type: "custom", event: "file-changed", data: { file: REGISTRY_TS } }, false)).toBe(true);
    expect(shouldSuppress({ type: "custom", event: "file-changed", data: { file: VUE } }, false)).toBe(true);
    // prune on delete
    expect(shouldSuppress({ type: "prune", paths: ["/components/content/ZzProbe.vue"] }, false)).toBe(true);
    // pathless full-reload and the Tailwind CSS update only inside the window
    expect(shouldSuppress({ type: "full-reload" }, true)).toBe(true);
    expect(shouldSuppress({ type: "full-reload" }, false)).toBe(false);
    const cssUpdate = { type: "update", updates: [{ path: "/assets/css/main.css" }] };
    expect(shouldSuppress(cssUpdate, true)).toBe(true);
    expect(shouldSuppress(cssUpdate, false)).toBe(false);
  });

  it("never drops unrelated traffic", () => {
    expect(shouldSuppress({ type: "connected" }, true)).toBe(false);
    expect(shouldSuppress({ type: "ping" }, true)).toBe(false);
    expect(shouldSuppress({ type: "error" }, true)).toBe(false);
    expect(shouldSuppress({ type: "custom", event: "other", data: { file: VUE } }, true)).toBe(false);
    expect(shouldSuppress({ type: "prune", paths: ["/components/content/A.vue", "/pages/x.vue"] }, false)).toBe(false);
  });
});

describe("agent reload guard: channel wrapping", () => {
  const setup = (markerOn: boolean) => {
    let marker = markerOn;
    let clock = 1_000;
    const sent: unknown[] = [];
    const channel = { send: (...args: unknown[]) => { sent.push(args.length === 1 ? args[0] : args); } };
    const guard = createAgentReloadGuard({
      markerPath: "/run/couchfusion/dev/radustanciu.agent-running",
      markerExists: () => marker,
      now: () => clock,
    });
    guard.wrap(channel);
    return {
      channel,
      sent,
      guard,
      setMarker: (value: boolean) => { marker = value; },
      advance: (ms: number) => { clock += ms; },
    };
  };

  it("passes everything through without the marker", () => {
    const t = setup(false);
    t.guard.noteFileEvent(VUE);
    t.channel.send({ type: "full-reload", path: "*", triggeredBy: VUE });
    t.channel.send({ type: "full-reload" });
    t.channel.send("file-changed", { file: REGISTRY_TS });
    expect(t.sent).toHaveLength(3);
    expect(t.guard.droppedCount()).toBe(0);
  });

  it("drops guarded messages while the marker exists, including the shorthand custom form", () => {
    const t = setup(true);
    t.guard.noteFileEvent(REGISTRY_TS);
    t.channel.send({ type: "full-reload", path: "*", triggeredBy: VUE });
    t.channel.send({ type: "full-reload" });
    t.channel.send("file-changed", { file: REGISTRY_TS });
    expect(t.sent).toHaveLength(0);
    expect(t.guard.droppedCount()).toBe(3);
  });

  it("closes the window after GUARD_WINDOW_MS so unrelated reloads still work mid-run", () => {
    const t = setup(true);
    t.guard.noteFileEvent(VUE);
    t.advance(GUARD_WINDOW_MS + 1);
    t.channel.send({ type: "full-reload" });
    t.channel.send({ type: "update", updates: [{ path: "/assets/css/main.css" }] });
    expect(t.sent).toHaveLength(2);
  });

  it("resumes normal HMR as soon as the marker is removed", () => {
    const t = setup(true);
    t.guard.noteFileEvent(VUE);
    t.setMarker(false);
    t.channel.send({ type: "full-reload", path: "*", triggeredBy: VUE });
    expect(t.sent).toHaveLength(1);
  });

  it("does not wrap the same channel twice", () => {
    const t = setup(true);
    const first = t.channel.send;
    t.guard.wrap(t.channel);
    expect(t.channel.send).toBe(first);
  });
});

describe("agent reload guard: registration", () => {
  const nuxtStub = (dev: boolean) => ({
    hooks: {} as Record<string, (...args: any[]) => unknown>,
    hook(name: string, fn: (...args: any[]) => unknown) { this.hooks[name] = fn; },
    options: { dev, nitro: { handlers: [] as any[] }, vite: { server: {} as any } },
  });

  it("is enabled only in dev with a marker path", () => {
    expect(agentReloadGuardEnabled(true, { COUCHFUSION_AGENT_MARKER: "/run/x" })).toBe(true);
    expect(agentReloadGuardEnabled(true, { COUCHFUSION_AGENT_MARKER: " " })).toBe(false);
    expect(agentReloadGuardEnabled(true, {})).toBe(false);
    expect(agentReloadGuardEnabled(false, { COUCHFUSION_AGENT_MARKER: "/run/x" })).toBe(false);
  });

  it("adds no Vite hook without the env var or in production", async () => {
    const plain = nuxtStub(true);
    await registerControlPlaneRoutes({}, plain, {});
    expect(plain.hooks["vite:extendConfig"]).toBeUndefined();
    const prod = nuxtStub(false);
    await registerControlPlaneRoutes({}, prod, { COUCHFUSION_AGENT_MARKER: "/run/x" });
    expect(prod.hooks["vite:extendConfig"]).toBeUndefined();
  });

  it("adds the plugin to the client Vite config only", async () => {
    const nuxt = nuxtStub(true);
    await registerControlPlaneRoutes({}, nuxt, { COUCHFUSION_AGENT_MARKER: "/run/x" });
    const extend = nuxt.hooks["vite:extendConfig"];
    const client: any = {};
    const server: any = {};
    extend(client, { isClient: true, isServer: false });
    extend(server, { isClient: false, isServer: true });
    expect(client.plugins.map((p: any) => p.name)).toEqual(["couchfusion:agent-reload-guard"]);
    expect(server.plugins).toBeUndefined();
  });

  it("wraps server.ws and prepends watcher listeners in configureServer", () => {
    const watcher = new EventEmitter();
    const viteListener = () => {};
    watcher.on("change", viteListener);
    const ws = { send: vi.fn() };
    const plugin = agentReloadGuardPlugin("/nonexistent/marker");
    plugin.configureServer({ ws, watcher, environments: { client: { hot: ws } } });
    expect((ws.send as any).__cfAgentGuard).toBe(true);
    // The guard's listener runs before Vite's own (already registered) watcher handler.
    const listeners = watcher.listeners("change");
    expect(listeners).toHaveLength(2);
    expect(listeners[0]).not.toBe(viteListener);
    expect(listeners[1]).toBe(viteListener);
    expect(watcher.listeners("add")).toHaveLength(1);
    expect(watcher.listeners("unlink")).toHaveLength(1);
  });
});
