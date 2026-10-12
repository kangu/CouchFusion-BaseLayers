/**
 * Generates the analytics map data:
 *   admin/utils/world-dots.ts       coarse dot grid + continent regions (always loaded)
 *   admin/utils/world-dots-fine.ts  2x resolution grid (lazy-loaded on first zoom)
 * Both are staggered dot grids of the world (Miller projection) where every
 * land dot is tagged with its ISO country.
 *
 * Dev-time only. Run from a folder that has these packages installed:
 *   npm i world-atlas@2 topojson-client@3 d3-geo@3 i18n-iso-countries@7 world-countries@5
 *   node generate-world-dots.mjs <path-to>/layers/analytics/admin/utils
 * Source data: Natural Earth (public domain) via world-atlas.
 */
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { feature } from "topojson-client";
import { geoBounds, geoCentroid, geoContains } from "d3-geo";

const require = createRequire(import.meta.url);
const isoCountries = require("i18n-iso-countries");
const worldCountries = require("world-countries");
const topology = JSON.parse(readFileSync(require.resolve("world-atlas/countries-50m.json"), "utf8"));

const LAT_TOP = 84;
const LAT_BOTTOM = -57;
const rad = Math.PI / 180;
const millerY = (lat) => 1.25 * Math.log(Math.tan(Math.PI / 4 + 0.4 * lat * rad));
const millerLat = (y) => (2.5 * (Math.atan(Math.exp(0.8 * y)) - Math.PI / 4)) / rad;
const yTop = millerY(LAT_TOP);

const features = feature(topology, topology.objects.countries).features
  .map((f) => {
    const code = f.id ? isoCountries.numericToAlpha2(String(f.id).padStart(3, "0")) : f.properties?.name === "Kosovo" ? "XK" : null;
    return code ? { code, feature: f, bounds: geoBounds(f), centroid: geoCentroid(f) } : null;
  })
  .filter(Boolean);

const inBounds = ([[w, s], [e, n]], [lon, lat]) =>
  lat >= s - 0.01 && lat <= n + 0.01 && (w <= e ? lon >= w - 0.01 && lon <= e + 0.01 : lon >= w - 0.01 || lon <= e + 0.01);

/** Builds one grid: { cols, rows, encoded, dots }. */
const buildGrid = (COLS) => {
  const dx = (2 * Math.PI) / COLS;
  const dy = dx * 0.866;
  const ROWS = Math.floor((yTop - millerY(LAT_BOTTOM)) / dy) + 1;
  const cellLonLat = (row, col) => [((col + (row % 2 ? 0.5 : 0) + 0.25) * dx - Math.PI) / rad, millerLat(yTop - row * dy)];

  const cells = new Array(ROWS * COLS).fill(null);
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const point = cellLonLat(row, col);
      for (const entry of features) {
        if (inBounds(entry.bounds, point) && geoContains(entry.feature, point)) {
          cells[row * COLS + col] = entry.code;
          break;
        }
      }
    }
  }

  // Countries too small to catch a dot get the free cell nearest their centroid.
  const present = new Set(cells.filter(Boolean));
  for (const entry of features) {
    if (present.has(entry.code)) continue;
    const [lon, lat] = entry.centroid;
    if (lat > LAT_TOP || lat < LAT_BOTTOM) continue;
    const row = Math.round((yTop - millerY(lat)) / dy);
    const col = Math.round((lon * rad + Math.PI) / dx - (row % 2 ? 0.5 : 0) - 0.25);
    let best = null;
    for (let r = row - 1; r <= row + 1; r += 1) {
      for (let c = col - 1; c <= col + 1; c += 1) {
        if (r < 0 || r >= ROWS || c < 0 || c >= COLS || cells[r * COLS + c]) continue;
        const [clon, clat] = cellLonLat(r, c);
        const distance = (clon - lon) ** 2 + (clat - lat) ** 2;
        if (!best || distance < best.distance) best = { index: r * COLS + c, distance };
      }
    }
    if (best) {
      cells[best.index] = entry.code;
      present.add(entry.code);
    }
  }

  const byCountry = {};
  cells.forEach((code, index) => {
    if (code) (byCountry[code] ??= []).push(index);
  });
  const encoded = Object.fromEntries(
    Object.keys(byCountry)
      .sort()
      .map((code) => {
        let previous = 0;
        return [
          code,
          byCountry[code]
            .map((index) => {
              const delta = index - previous;
              previous = index;
              return delta.toString(36);
            })
            .join(","),
        ];
      }),
  );
  return { cols: COLS, rows: ROWS, encoded, dots: cells.filter(Boolean).length };
};

// Continent regions: a fixed lon/lat view box plus the member countries.
const REGION_BOXES = {
  NA: { name: "North America", box: [-170, 7, -12, 84] },
  SA: { name: "South America", box: [-93, -57, -32, 14] },
  EU: { name: "Europe", box: [-26, 34, 62, 72] },
  AF: { name: "Africa", box: [-20, -36, 55, 38] },
  AS: { name: "Asia", box: [26, -11, 180, 78] },
  OC: { name: "Oceania", box: [110, -48, 180, 0] },
};
const continentOf = (country) => {
  if (country.region === "Europe") return "EU";
  if (country.region === "Asia") return "AS";
  if (country.region === "Africa") return "AF";
  if (country.region === "Oceania") return "OC";
  if (country.region === "Americas") return country.subregion === "South America" ? "SA" : "NA";
  return null;
};
const members = Object.fromEntries(Object.keys(REGION_BOXES).map((id) => [id, []]));
for (const country of worldCountries) {
  const id = continentOf(country);
  if (id) members[id].push(country.cca2);
}
members.EU.push("XK");

// Boxes in normalized map units: x in [0, 1] of the map width, y in the same unit.
const normalize = ([west, south, east, north]) => [
  (west * rad + Math.PI) / (2 * Math.PI),
  (yTop - millerY(north)) / (2 * Math.PI),
  (east * rad + Math.PI) / (2 * Math.PI),
  (yTop - millerY(south)) / (2 * Math.PI),
].map((n) => Math.round(n * 10000) / 10000);

const regions = Object.fromEntries(
  Object.entries(REGION_BOXES).map(([id, { name, box }]) => [id, { name, box: normalize(box), countries: [...new Set(members[id])].sort().join("") }]),
);

const header = (grid, extra) => `/**
 * World dot grid for the analytics map. GENERATED by
 * scripts/generate-world-dots.mjs from Natural Earth data (public domain).
 * Do not edit by hand.
 *
 * Staggered grid (odd rows shifted half a cell), Miller projection,
 * ${grid.cols} x ${grid.rows} cells, ${grid.dots} land dots, ${Object.keys(grid.encoded).length} countries.
 * Each country lists its cell indexes (row * cols + col), delta-encoded in base 36.${extra}
 */`;

const outDir = process.argv[2];
const coarse = buildGrid(156);
const fine = buildGrid(312);

writeFileSync(
  join(outDir, "world-dots.ts"),
  `${header(coarse, "\n * WORLD_REGIONS: continent view boxes [x0, y0, x1, y1] in map-width units and\n * their countries (concatenated ISO codes).")}
export const WORLD_COLS = ${coarse.cols};
export const WORLD_ROWS = ${coarse.rows};

export const WORLD_DOTS: Record<string, string> = ${JSON.stringify(coarse.encoded)};

export const WORLD_REGIONS: Record<string, { name: string; box: [number, number, number, number]; countries: string }> = ${JSON.stringify(regions)};
`,
);
writeFileSync(
  join(outDir, "world-dots-fine.ts"),
  `${header(fine, "\n * Loaded lazily the first time the map zooms into a continent.")}
export const FINE_COLS = ${fine.cols};
export const FINE_ROWS = ${fine.rows};

export const FINE_DOTS: Record<string, string> = ${JSON.stringify(fine.encoded)};
`,
);
console.log(JSON.stringify({ coarse: [coarse.cols, coarse.rows, coarse.dots], fine: [fine.cols, fine.rows, fine.dots], regions: Object.fromEntries(Object.entries(regions).map(([k, v]) => [k, [v.box, v.countries.length / 2]])) }));
