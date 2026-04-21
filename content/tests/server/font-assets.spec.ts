import { describe, expect, it } from "vitest";
import {
  filterBunnyFontFaces,
  parseBunnyFontFaces,
  toFontFamilyLabel,
} from "../../server/utils/content-fonts";

const SAMPLE_CSS = `/* latin */
@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 400;
  src: url(https://fonts.bunny.net/inter/files/inter-latin-400-normal.woff2) format('woff2'), url(https://fonts.bunny.net/inter/files/inter-latin-400-normal.woff) format('woff');
  unicode-range: U+0000-00FF;
}

/* latin-ext */
@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 400;
  src: url(https://fonts.bunny.net/inter/files/inter-latin-ext-400-normal.woff2) format('woff2');
  unicode-range: U+0100-024F;
}

/* latin */
@font-face {
  font-family: 'Inter';
  font-style: italic;
  font-weight: 700;
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
    expect(faces[0]?.remoteUrl).toContain("inter-latin-400-normal.woff2");
  });

  it("keeps latin subset only when available for requested styles/weights", () => {
    const faces = parseBunnyFontFaces(SAMPLE_CSS);
    const filtered = filterBunnyFontFaces(faces, {
      styles: ["normal", "italic"],
      weights: [400, 700],
    });

    expect(filtered).toHaveLength(2);
    expect(filtered.every((entry) => entry.subset === "latin")).toBe(true);
    expect(filtered.map((entry) => `${entry.style}-${entry.weight}`)).toEqual([
      "normal-400",
      "italic-700",
    ]);
  });

  it("converts slug to readable family label", () => {
    expect(toFontFamilyLabel("playfair-display")).toBe("Playfair Display");
  });
});
