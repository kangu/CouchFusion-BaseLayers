import { describe, expect, it } from "vitest";
import {
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
