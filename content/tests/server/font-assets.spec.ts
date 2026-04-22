import { describe, expect, it } from "vitest";
import {
  mergeContentFontSettingsIntoMainSettings,
  filterBunnyFontFaces,
  parseBunnyFontFaces,
  toFontFamilyLabel,
} from "../../server/utils/content-fonts";

const SAMPLE_CSS = `/* latin */
@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 400;
  font-stretch: 100%;
  src: url(https://fonts.bunny.net/inter/files/inter-latin-400-normal.woff2) format('woff2'), url(https://fonts.bunny.net/inter/files/inter-latin-400-normal.woff) format('woff');
  unicode-range: U+0000-00FF;
}

/* latin-ext */
@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 400;
  font-stretch: 75%;
  src: url(https://fonts.bunny.net/inter/files/inter-latin-ext-400-normal.woff2) format('woff2');
  unicode-range: U+0100-024F;
}

/* latin */
@font-face {
  font-family: 'Inter';
  font-style: italic;
  font-weight: 700;
  font-stretch: 100%;
  src: url(https://fonts.bunny.net/inter/files/inter-latin-700-italic.woff2) format('woff2');
  unicode-range: U+0000-00FF;
}`;

describe("content-fonts bunny css parsing", () => {
  it("extracts faces with metadata and woff2 source", () => {
    const faces = parseBunnyFontFaces(SAMPLE_CSS);

    expect(faces).toHaveLength(3);
    expect(faces[0]?.subset).toBe("latin");
    expect(faces[0]?.family).toBe("Inter");
    expect(faces[0]?.style).toBe("normal");
    expect(faces[0]?.weight).toBe(400);
    expect(faces[0]?.stretch).toBe("100%");
    expect(faces[0]?.remoteUrl).toContain("inter-latin-400-normal.woff2");
  });

  it("keeps latin subset only when available for requested styles/weights/widths", () => {
    const faces = parseBunnyFontFaces(SAMPLE_CSS);
    const filtered = filterBunnyFontFaces(faces, {
      styles: ["normal", "italic"],
      weights: [400, 700],
      widths: ["100%"],
    });

    expect(filtered).toHaveLength(2);
    expect(filtered.every((entry) => entry.subset === "latin")).toBe(true);
    expect(
      filtered.map((entry) => `${entry.style}-${entry.weight}-${entry.stretch}`),
    ).toEqual([
      "normal-400-100%",
      "italic-700-100%",
    ]);
  });

  it("converts slug to readable family label", () => {
    expect(toFontFamilyLabel("playfair-display")).toBe("Playfair Display");
  });

  it("merges content font settings into the main settings document", () => {
    const merged = mergeContentFontSettingsIntoMainSettings(
      {
        _id: "settings",
        navigation: { main: [{ label: "Home", href: "/" }] },
      },
      {
        sansFamily: "inter",
        displayFamily: "playfair-display",
        styles: ["normal", "italic"],
        weights: [300, 400, 700],
        widths: ["100%", "125%"],
        status: "applied",
        lastApplyError: null,
        lastAppliedAt: "2026-04-22T12:00:00.000Z",
        lastAppliedBy: "radu",
        runtimeCssVersion: 123,
        runtimeCssPath: "/fonts/managed/runtime-fonts.css",
        updatedAt: "2026-04-22T12:00:00.000Z",
        updatedBy: "radu",
      },
    );

    expect(merged).toMatchObject({
      _id: "settings",
      navigation: { main: [{ label: "Home", href: "/" }] },
      contentFonts: {
        sansFamily: "inter",
        displayFamily: "playfair-display",
        widths: ["100%", "125%"],
        weights: [300, 400, 700],
      },
    });
  });
});
