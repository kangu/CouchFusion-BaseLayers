import { describe, expect, it } from "vitest";
import {
  getContentThemeSchema,
  getContentThemePresetBySlug,
  normalizeContentThemeDraftTokens,
  renderRuntimeThemeCss,
} from "../../server/utils/content-theme";

describe("content theme presets", () => {
  it("returns bitvocation preset defaults", () => {
    const preset = getContentThemePresetBySlug("bitvocation");

    expect(preset["--color-primary"]).toBe("#f8931a");
    expect(preset["--radius"]).toBe("0.5rem");
  });

  it("returns empty preset for unknown slug", () => {
    expect(getContentThemePresetBySlug("unknown-app")).toEqual({});
  });

  it("returns CouchFusion preset defaults for cfcom slugs", () => {
    const cfcomPreset = getContentThemePresetBySlug("cfcom");
    const couchfusionPreset = getContentThemePresetBySlug("couchfusioncom");

    expect(cfcomPreset["--color-primary"]).toBe("#22c55e");
    expect(cfcomPreset["--color-secondary"]).toBe("#f7931a");
    expect(cfcomPreset["--background"]).toBe("38 35% 93%");
    expect(cfcomPreset["--foreground"]).toBe("0 0% 8%");
    expect(cfcomPreset["--radius"]).toBe("1rem");
    expect(couchfusionPreset).toEqual(cfcomPreset);
  });

  it("returns CouchFusion simple theme labels without Bitvocation artifacts", () => {
    const schema = getContentThemeSchema("cfcom");
    const simpleLabels = schema.simpleTokenKeys
      .map((key) => schema.tokens.find((token) => token.key === key)?.label)
      .filter(Boolean);

    expect(simpleLabels).toEqual([
      "CouchFusion Green",
      "Bitcoin Orange",
      "Paper Background",
      "Ink Foreground",
      "Radius",
    ]);
    expect(simpleLabels).not.toContain("Orange Custom");
    expect(simpleLabels).not.toContain("Orange Custom Hover");
  });
});

describe("content theme draft normalization", () => {
  it("accepts writable allowlisted theme tokens", () => {
    expect(
      normalizeContentThemeDraftTokens({
        "--color-primary": "#ff6600",
        "--radius": "0.75rem",
      }),
    ).toEqual({
      "--color-primary": "#ff6600",
      "--radius": "0.75rem",
    });
  });

  it("rejects read-only font tokens", () => {
    expect(() =>
      normalizeContentThemeDraftTokens({
        "--font-sans": "Inter, sans-serif",
      }),
    ).toThrow(/read-only/i);
  });

  it("rejects unknown tokens", () => {
    expect(() =>
      normalizeContentThemeDraftTokens({
        "--unknown-token": "x",
      }),
    ).toThrow(/unsupported/i);
  });

  it("rejects invalid length values", () => {
    expect(() =>
      normalizeContentThemeDraftTokens({
        "--radius": "wide",
      }),
    ).toThrow(/invalid value/i);
  });
});

describe("content theme runtime css rendering", () => {
  it("renders writable theme tokens only", () => {
    const css = renderRuntimeThemeCss({
      "--color-primary": "#f8931a",
      "--font-sans": "Inter, sans-serif",
      "--breakpoint-xs": "25rem",
      "--radius": "0.5rem",
    });

    expect(css).toContain("--color-primary: #f8931a;");
    expect(css).toContain("--radius: 0.5rem;");
    expect(css).not.toContain("--font-sans:");
    expect(css).not.toContain("--breakpoint-xs:");
  });
});
