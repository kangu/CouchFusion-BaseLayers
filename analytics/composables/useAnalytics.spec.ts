/** @vitest-environment jsdom */
// The browser client sends nothing when the page was loaded as the content builder's live
// preview (?inline-preview=1), including after in-preview navigation drops the parameter.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type ClientModule = typeof import("./useAnalytics");

/** Imports a fresh copy of the module as if the page had been loaded at `url`. */
const loadAt = async (url: string): Promise<ClientModule> => {
  window.history.replaceState({}, "", url);
  vi.resetModules();
  return import("./useAnalytics");
};

describe("analytics client on builder previews", () => {
  let beacon: ReturnType<typeof vi.fn>;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    beacon = vi.fn(() => true);
    fetchMock = vi.fn(async () => new Response("{}"));
    Object.defineProperty(navigator, "sendBeacon", { value: beacon, configurable: true, writable: true });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.history.replaceState({}, "", "/");
  });

  it("sends pageviews and events on a normal page load", async () => {
    const { createAnalyticsClient, isPreviewPageLoad } = await loadAt("/?utm_source=newsletter");
    const client = createAnalyticsClient();
    await client.trackPageview();
    await client.trackEvent("section_view", { section: "harta" });

    expect(isPreviewPageLoad()).toBe(false);
    expect(beacon).toHaveBeenCalledTimes(2);
    // jsdom's Blob has no text(); read it the old way.
    const text = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsText(beacon.mock.calls[1][1] as Blob);
    });
    const body = JSON.parse(text);
    expect(body.payload).toMatchObject({ name: "section_view", data: { section: "harta" } });
  });

  it("sends nothing at all when the page was loaded with ?inline-preview", async () => {
    const { createAnalyticsClient, isPreviewPageLoad } = await loadAt("/?inline-preview=1&preview-motion=reduce");
    const client = createAnalyticsClient();
    await client.trackPageview();
    await client.trackEvent("game_start", { game: "sala" });
    await client.identify("someone");

    // A navigation inside the preview drops the parameter: still a preview page load.
    window.history.replaceState({}, "", "/test/head");
    await client.trackRouterNavigation({ fullPath: "/test/head" }, { fullPath: "/" });

    expect(isPreviewPageLoad()).toBe(true);
    expect(beacon).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("recognises only the preview parameter", async () => {
    const { isPreviewUrl } = await loadAt("/");
    expect(isPreviewUrl("?inline-preview=1")).toBe(true);
    expect(isPreviewUrl("?a=1&inline-preview")).toBe(true);
    expect(isPreviewUrl("?preview=1")).toBe(false);
    expect(isPreviewUrl("")).toBe(false);
  });
});
