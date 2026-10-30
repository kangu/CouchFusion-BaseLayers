import { describe, expect, it, vi } from "vitest";
import registerControlPlaneRoutes, {
  CONTROL_PLANE_ROUTES,
  controlPlaneEnabled,
  publicOriginHostname,
} from "../../utils/register-control-plane-routes";
import { validControlToken } from "../../runtime/control-plane/token";
import {
  componentTagNames,
  findComponentPageUsage,
  scanPageComponentUsage,
} from "../../server/utils/component-usage";

const nuxtStub = (dev: boolean) => ({
  hook: vi.fn(),
  options: { dev, nitro: { handlers: [] as any[] }, vite: { server: {} as any } },
});

describe("control-plane route registration", () => {
  it("is enabled only in dev with a non-empty token", () => {
    expect(controlPlaneEnabled(true, { COUCHFUSION_CONTROL_TOKEN: "t" })).toBe(true);
    expect(controlPlaneEnabled(true, { COUCHFUSION_CONTROL_TOKEN: "  " })).toBe(false);
    expect(controlPlaneEnabled(true, {})).toBe(false);
    expect(controlPlaneEnabled(false, { COUCHFUSION_CONTROL_TOKEN: "t" })).toBe(false);
  });

  it("registers nothing without the supervisor environment", async () => {
    const nuxt = nuxtStub(true);
    await registerControlPlaneRoutes({}, nuxt, {});
    expect(nuxt.options.nitro.handlers).toEqual([]);
    expect(nuxt.options.vite.server.allowedHosts).toBeUndefined();
  });

  it("registers nothing in production builds even with the variables set", async () => {
    const nuxt = nuxtStub(false);
    await registerControlPlaneRoutes({}, nuxt, {
      COUCHFUSION_CONTROL_TOKEN: "t",
      COUCHFUSION_PUBLIC_ORIGIN: "https://hetzner1.tailb7471b.ts.net:9181",
    });
    expect(nuxt.options.nitro.handlers).toEqual([]);
    expect(nuxt.options.vite.server.allowedHosts).toBeUndefined();
  });

  it("registers exactly the two GET routes in dev with a token", async () => {
    const nuxt = nuxtStub(true);
    await registerControlPlaneRoutes({}, nuxt, { COUCHFUSION_CONTROL_TOKEN: "t" });
    expect(nuxt.options.nitro.handlers.map((entry) => entry.route)).toEqual(
      CONTROL_PLANE_ROUTES.map((entry) => entry.route),
    );
    for (const entry of nuxt.options.nitro.handlers) {
      expect(entry.method).toBe("get");
      expect(entry.handler).toMatch(/runtime\/control-plane\/.+\.get\.ts$/);
    }
  });

  it("adds only the slot hostname to allowedHosts and never overrides hmr", async () => {
    const nuxt = nuxtStub(true);
    nuxt.options.vite.server.allowedHosts = ["example.test"];
    await registerControlPlaneRoutes({}, nuxt, {
      COUCHFUSION_PUBLIC_ORIGIN: "https://hetzner1.tailb7471b.ts.net:9181",
    });
    expect(nuxt.options.vite.server.allowedHosts).toEqual(["example.test", "hetzner1.tailb7471b.ts.net"]);
    expect(nuxt.options.vite.server.hmr).toBeUndefined();

    const permissive = nuxtStub(true);
    permissive.options.vite.server.allowedHosts = true;
    await registerControlPlaneRoutes({}, permissive, { COUCHFUSION_PUBLIC_ORIGIN: "https://a.test:1" });
    expect(permissive.options.vite.server.allowedHosts).toBe(true);
  });

  it("parses the public origin hostname defensively", () => {
    expect(publicOriginHostname({ COUCHFUSION_PUBLIC_ORIGIN: "http://localhost:9181" })).toBe("localhost");
    expect(publicOriginHostname({ COUCHFUSION_PUBLIC_ORIGIN: "javascript:alert(1)" })).toBeNull();
    expect(publicOriginHostname({ COUCHFUSION_PUBLIC_ORIGIN: "not a url" })).toBeNull();
    expect(publicOriginHostname({})).toBeNull();
  });
});

describe("control token", () => {
  it("compares in constant time and never matches empty values", () => {
    expect(validControlToken("abc", "abc")).toBe(true);
    expect(validControlToken("abd", "abc")).toBe(false);
    expect(validControlToken("ab", "abc")).toBe(false);
    expect(validControlToken("", "")).toBe(false);
    expect(validControlToken("abc", "")).toBe(false);
  });
});

describe("component page usage", () => {
  const docs = [
    { _id: "page-/", path: "/", title: "Home", body: { type: "minimal", value: [["network-hero", { title: "x" }], ["p", {}, "network-hero"]] } },
    { _id: "page-/::ro", path: "/", title: "Acasă", body: { type: "minimal", value: [["div", {}, ["NetworkHero", {}]]] } },
    { _id: "page-/about", path: "/about", title: null, body: { type: "minimal", value: [["p", {}, "network-hero"]] } },
    { _id: "page-/nested", path: "/nested", title: "Nested", body: { type: "minimal", value: [["template", { slot: "x" }, ["section", {}, ["network-hero"]]]] } },
    { _id: "oldpage-/", path: "/", title: "Old", body: { type: "minimal", value: [["network-hero", {}]] } },
    { _id: "_design/content", views: {} },
    { _id: "page-/broken", path: "/broken" },
  ];
  const loader = async () => docs;

  it("derives kebab and PascalCase tag names", () => {
    expect(componentTagNames("network-hero")).toEqual(["network-hero", "NetworkHero"]);
    expect(componentTagNames("hero")).toEqual(["hero", "Hero"]);
  });

  it("finds master and locale pages, nested usage, and ignores text nodes and old pages", async () => {
    const result = await findComponentPageUsage("network-hero", loader);
    expect(result.scanned).toBe(5);
    expect(result.pages).toEqual([
      { id: "page-/", path: "/", title: "Home" },
      { id: "page-/::ro", path: "/", title: "Acasă" },
      { id: "page-/nested", path: "/nested", title: "Nested" },
    ]);
  });

  it("rejects invalid ids without scanning", async () => {
    const spy = vi.fn(loader);
    expect(await findComponentPageUsage("../etc", spy)).toEqual({ pages: [], scanned: 0 });
    expect(await findComponentPageUsage("NetworkHero", spy)).toEqual({ pages: [], scanned: 0 });
    expect(spy).not.toHaveBeenCalled();
  });

  it("keeps the global-alias behaviour of matching bare text nodes when asked", async () => {
    const result = await scanPageComponentUsage(["network-hero"], { matchTextNodes: true }, loader);
    expect(result.pages.map((page) => page.id)).toEqual(["page-/", "page-/about", "page-/nested"]);
  });
});
