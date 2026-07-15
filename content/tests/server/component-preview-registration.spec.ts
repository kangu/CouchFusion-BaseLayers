import { describe, expect, it, vi } from "vitest";
import registerComponentPreviewPages, {
  previewEnabled,
} from "../../utils/register-component-preview-pages";
import { validPreviewRequest } from "../../runtime/component-preview/guard";

describe("component preview registration", () => {
  it("enables preview pages only for the explicit host environment", () => {
    expect(previewEnabled({ COUCHFUSION_PREVIEW: "1" })).toBe(true);
    expect(previewEnabled({ COUCHFUSION_PREVIEW: "true" })).toBe(false);
    expect(previewEnabled({})).toBe(false);
  });

  it("registers exactly the shell, render page, and guard when enabled", async () => {
    const hooks: Record<string, (value: any) => void> = {};
    const nuxt = {
      hook: vi.fn((name: string, callback: (value: any) => void) => {
        hooks[name] = callback;
      }),
      options: { nitro: { handlers: [] as any[] } },
    };

    await registerComponentPreviewPages({}, nuxt, {
      COUCHFUSION_PREVIEW: "1",
    });
    const pages: any[] = [];
    hooks["pages:extend"]?.(pages);

    expect(pages.map(({ path }) => path)).toEqual([
      "/__couchfusion/components/preview/:componentId",
      "/__couchfusion/components/render/:componentId",
    ]);
    expect(nuxt.options.nitro.handlers).toHaveLength(1);
    expect(nuxt.options.nitro.handlers[0]).toMatchObject({ middleware: true });
  });

  it("does not register routes or middleware when disabled", async () => {
    const nuxt = {
      hook: vi.fn(),
      options: { nitro: { handlers: [] as any[] } },
    };

    await registerComponentPreviewPages({}, nuxt, {});

    expect(nuxt.hook).not.toHaveBeenCalled();
    expect(nuxt.options.nitro.handlers).toEqual([]);
  });

  it("accepts only matching tokens on the two preview paths", () => {
    expect(
      validPreviewRequest(
        "/__couchfusion/components/render/hero",
        "good",
        "good",
      ),
    ).toBe(true);
    expect(
      validPreviewRequest(
        "/__couchfusion/components/preview/hero",
        "bad",
        "good",
      ),
    ).toBe(false);
    expect(validPreviewRequest("/ordinary-page", "", "")).toBe(true);
  });
});
