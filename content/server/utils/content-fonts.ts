import { promises as fs } from "node:fs";
import { basename, join } from "node:path";
import { createHash } from "node:crypto";
import { createError } from "h3";
import {
  buildCouchEnvSection,
  normalizeCouchEnvSlug,
  readCouchConfigValues,
} from "#database/utils/couch-config";
import { getDocument, putDocument, type CouchDBDocument } from "#database/utils/couchdb";
import {
  getContentDatabaseName,
  getMainDatabaseName,
  getMainSettingsDocumentId,
} from "./database";

export const CONTENT_FONT_SETTINGS_DOC_ID = "content-settings:fonts";

const MANAGED_FONTS_DIR = "fonts/managed";
const RUNTIME_FONTS_FILE_NAME = "runtime-fonts.css";
const MANAGED_ASSETS_START = "/* content-fonts:managed:start */";
const MANAGED_ASSETS_END = "/* content-fonts:managed:end */";

const ALLOWLIST_CONFIG_KEY = "content_fonts_allowlist";
const DEFAULT_SANS_CONFIG_KEY = "content_fonts_default_sans";
const DEFAULT_DISPLAY_CONFIG_KEY = "content_fonts_default_display";

const DEFAULT_ALLOWLIST = ["inter", "lato", "playfair-display"];
const DEFAULT_PROFILE_WEIGHTS = [300, 400, 700] as const;
const DEFAULT_PROFILE_STYLES = ["normal", "italic"] as const;
const DEFAULT_PROFILE_WIDTHS = ["100%"] as const;

const FONT_STYLE_VALUES = ["normal", "italic"] as const;
const FONT_STRETCH_PRESET_VALUES = [
  "50%",
  "62.5%",
  "75%",
  "87.5%",
  "100%",
  "112.5%",
  "125%",
  "150%",
  "200%",
] as const;
export type ContentFontStyle = (typeof FONT_STYLE_VALUES)[number];
export type ContentFontWidth = string;

export interface ContentFontFamilyOption {
  slug: string;
  label: string;
}

export interface ParsedBunnyFontFace {
  family: string;
  subset: string | null;
  style: ContentFontStyle;
  weight: number;
  stretch: ContentFontWidth;
  unicodeRange: string | null;
  remoteUrl: string;
}

export interface ContentFontSettingsDocument extends CouchDBDocument {
  _id: typeof CONTENT_FONT_SETTINGS_DOC_ID;
  type: "content-font-settings";
  sansFamily: string;
  displayFamily: string;
  profile: "minimal";
  styles: ContentFontStyle[];
  weights: number[];
  widths: ContentFontWidth[];
  status: "idle" | "applied" | "failed";
  lastApplyError: string | null;
  lastAppliedAt: string | null;
  lastAppliedBy: string | null;
  runtimeCssVersion: number;
  runtimeCssPath: string;
  updatedAt: string;
  updatedBy: string | null;
}

export interface ContentFontRuntimeConfig {
  slug: string;
  section: string;
  allowlist: ContentFontFamilyOption[];
  defaultSans: string;
  defaultDisplay: string;
}

interface MainSettingsDocument extends CouchDBDocument {
  _id: string;
  contentFonts?: Partial<ContentFontSettingsDocument>;
  [key: string]: unknown;
}

const nowIso = () => new Date().toISOString();

const normalizeSlug = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-");
  const cleaned = normalized.replace(/-+/g, "-").replace(/^-+|-+$/g, "");
  return cleaned.length > 0 ? cleaned : null;
};

export const toFontFamilyLabel = (slug: string): string =>
  slug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const parseAllowlist = (value: string | null): string[] => {
  if (!value || !value.trim()) {
    return [];
  }
  const unique = new Set<string>();
  for (const entry of value.split(",")) {
    const normalized = normalizeSlug(entry);
    if (normalized) {
      unique.add(normalized);
    }
  }
  return Array.from(unique.values());
};

const resolveConfiguredDefaults = (
  allowlist: string[],
  configuredSans: string | null,
  configuredDisplay: string | null,
): { defaultSans: string; defaultDisplay: string } => {
  const fallbackSans = allowlist.includes("lato") ? "lato" : allowlist[0];
  const fallbackDisplay = allowlist.includes("playfair-display")
    ? "playfair-display"
    : allowlist[Math.min(1, allowlist.length - 1)] ?? allowlist[0];

  const normalizedSans = normalizeSlug(configuredSans);
  const normalizedDisplay = normalizeSlug(configuredDisplay);

  return {
    defaultSans:
      normalizedSans && allowlist.includes(normalizedSans)
        ? normalizedSans
        : fallbackSans,
    defaultDisplay:
      normalizedDisplay && allowlist.includes(normalizedDisplay)
        ? normalizedDisplay
        : fallbackDisplay,
  };
};

export const getContentFontRuntimeConfig = async (): Promise<ContentFontRuntimeConfig> => {
  const cwdName = process.cwd().split("/").filter(Boolean).pop() ?? "app";
  const slug = normalizeCouchEnvSlug(cwdName) || "app";
  const section = buildCouchEnvSection(slug);

  const configValues = await readCouchConfigValues(section, [
    ALLOWLIST_CONFIG_KEY,
    DEFAULT_SANS_CONFIG_KEY,
    DEFAULT_DISPLAY_CONFIG_KEY,
  ]);

  const parsedAllowlist = parseAllowlist(configValues[ALLOWLIST_CONFIG_KEY]);
  const allowlist = parsedAllowlist.length > 0 ? parsedAllowlist : DEFAULT_ALLOWLIST;
  const defaults = resolveConfiguredDefaults(
    allowlist,
    configValues[DEFAULT_SANS_CONFIG_KEY],
    configValues[DEFAULT_DISPLAY_CONFIG_KEY],
  );

  return {
    slug,
    section,
    allowlist: allowlist.map((entry) => ({
      slug: entry,
      label: toFontFamilyLabel(entry),
    })),
    defaultSans: defaults.defaultSans,
    defaultDisplay: defaults.defaultDisplay,
  };
};

const normalizeStyles = (value: unknown): ContentFontStyle[] => {
  const source = Array.isArray(value) ? value : [];
  const normalized = source
    .map((entry) => (typeof entry === "string" ? entry.trim().toLowerCase() : ""))
    .filter((entry): entry is ContentFontStyle =>
      FONT_STYLE_VALUES.includes(entry as ContentFontStyle),
    );
  return Array.from(new Set(normalized));
};

const normalizeWeights = (value: unknown): number[] => {
  const source = Array.isArray(value) ? value : [];
  const normalized = source
    .map((entry) => Number(entry))
    .filter((entry) => Number.isFinite(entry))
    .map((entry) => Math.max(100, Math.min(900, Math.round(entry / 100) * 100)));
  return Array.from(new Set(normalized)).sort((a, b) => a - b);
};

const parseWidthNumber = (value: string): number | null => {
  const numeric = Number.parseFloat(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const compareWidths = (left: string, right: string) => {
  const leftValue = parseWidthNumber(left);
  const rightValue = parseWidthNumber(right);

  if (leftValue !== null && rightValue !== null) {
    return leftValue - rightValue;
  }

  return left.localeCompare(right);
};

const normalizeWidthValue = (value: unknown): ContentFontWidth | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return `${value}%`;
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    return null;
  }

  if (trimmed.endsWith("%")) {
    const numeric = parseWidthNumber(trimmed.slice(0, -1));
    return numeric !== null ? `${numeric}%` : null;
  }

  const numeric = parseWidthNumber(trimmed);
  if (numeric !== null) {
    return `${numeric}%`;
  }

  return null;
};

const normalizeWidths = (value: unknown): ContentFontWidth[] => {
  const source = Array.isArray(value) ? value : [];
  const normalized = source
    .map((entry) => normalizeWidthValue(entry))
    .filter((entry): entry is ContentFontWidth => Boolean(entry));
  return Array.from(new Set(normalized)).sort(compareWidths);
};

const defaultSettingsDocument = (
  runtimeConfig: ContentFontRuntimeConfig,
): ContentFontSettingsDocument => {
  const timestamp = nowIso();
  return {
    _id: CONTENT_FONT_SETTINGS_DOC_ID,
    type: "content-font-settings",
    sansFamily: runtimeConfig.defaultSans,
    displayFamily: runtimeConfig.defaultDisplay,
    profile: "minimal",
    styles: [...DEFAULT_PROFILE_STYLES],
    weights: [...DEFAULT_PROFILE_WEIGHTS],
    widths: [...DEFAULT_PROFILE_WIDTHS],
    status: "idle",
    lastApplyError: null,
    lastAppliedAt: null,
    lastAppliedBy: null,
    runtimeCssVersion: Date.now(),
    runtimeCssPath: `/${MANAGED_FONTS_DIR}/${RUNTIME_FONTS_FILE_NAME}`,
    updatedAt: timestamp,
    updatedBy: null,
  };
};

const ensureAllowedFamily = (candidate: unknown, allowlist: string[], fallback: string) => {
  const normalized = normalizeSlug(candidate);
  if (!normalized) {
    return fallback;
  }
  return allowlist.includes(normalized) ? normalized : fallback;
};

const normalizeSettingsDocument = (
  value: unknown,
  runtimeConfig: ContentFontRuntimeConfig,
): ContentFontSettingsDocument => {
  const defaults = defaultSettingsDocument(runtimeConfig);
  if (!value || typeof value !== "object") {
    return defaults;
  }

  const source = value as Record<string, any>;
  const styles = normalizeStyles(source.styles);
  const weights = normalizeWeights(source.weights);
  const widths = normalizeWidths(source.widths);

  return {
    ...defaults,
    _rev: typeof source._rev === "string" ? source._rev : undefined,
    sansFamily: ensureAllowedFamily(
      source.sansFamily,
      runtimeConfig.allowlist.map((entry) => entry.slug),
      defaults.sansFamily,
    ),
    displayFamily: ensureAllowedFamily(
      source.displayFamily,
      runtimeConfig.allowlist.map((entry) => entry.slug),
      defaults.displayFamily,
    ),
    profile: "minimal",
    styles: styles.length > 0 ? styles : defaults.styles,
    weights: weights.length > 0 ? weights : defaults.weights,
    widths: widths.length > 0 ? widths : defaults.widths,
    status:
      source.status === "applied" || source.status === "failed" || source.status === "idle"
        ? source.status
        : defaults.status,
    lastApplyError:
      typeof source.lastApplyError === "string" && source.lastApplyError.trim()
        ? source.lastApplyError.trim()
        : null,
    lastAppliedAt:
      typeof source.lastAppliedAt === "string" && source.lastAppliedAt.trim()
        ? source.lastAppliedAt
        : null,
    lastAppliedBy:
      typeof source.lastAppliedBy === "string" && source.lastAppliedBy.trim()
        ? source.lastAppliedBy
        : null,
    runtimeCssVersion:
      typeof source.runtimeCssVersion === "number" && Number.isFinite(source.runtimeCssVersion)
        ? source.runtimeCssVersion
        : defaults.runtimeCssVersion,
    runtimeCssPath:
      typeof source.runtimeCssPath === "string" && source.runtimeCssPath.trim()
        ? source.runtimeCssPath
        : defaults.runtimeCssPath,
    updatedAt:
      typeof source.updatedAt === "string" && source.updatedAt.trim()
        ? source.updatedAt
        : defaults.updatedAt,
    updatedBy:
      typeof source.updatedBy === "string" && source.updatedBy.trim()
        ? source.updatedBy
        : null,
  };
};

const getContentFontSettingsFromMainSettings = (
  value: unknown,
): Partial<ContentFontSettingsDocument> | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const source = value as Record<string, any>;
  if (!source.contentFonts || typeof source.contentFonts !== "object") {
    return null;
  }

  return source.contentFonts as Partial<ContentFontSettingsDocument>;
};

const toPersistedContentFontSettings = (
  settings: ContentFontSettingsDocument,
): Partial<ContentFontSettingsDocument> => ({
  sansFamily: settings.sansFamily,
  displayFamily: settings.displayFamily,
  profile: settings.profile,
  styles: [...settings.styles],
  weights: [...settings.weights],
  widths: [...settings.widths],
  status: settings.status,
  lastApplyError: settings.lastApplyError,
  lastAppliedAt: settings.lastAppliedAt,
  lastAppliedBy: settings.lastAppliedBy,
  runtimeCssVersion: settings.runtimeCssVersion,
  runtimeCssPath: settings.runtimeCssPath,
  updatedAt: settings.updatedAt,
  updatedBy: settings.updatedBy,
});

export const mergeContentFontSettingsIntoMainSettings = (
  value: unknown,
  settings: Omit<ContentFontSettingsDocument, "_id" | "_rev" | "type" | "profile"> &
    Partial<Pick<ContentFontSettingsDocument, "profile">>,
): MainSettingsDocument => {
  const source = value && typeof value === "object"
    ? value as MainSettingsDocument
    : { _id: "settings" };

  return {
    ...source,
    _id: typeof source._id === "string" && source._id.trim() ? source._id : "settings",
    contentFonts: {
      ...toPersistedContentFontSettings({
        _id: CONTENT_FONT_SETTINGS_DOC_ID,
        type: "content-font-settings",
        profile: settings.profile ?? "minimal",
        _rev: undefined,
        ...settings,
      }),
    },
  };
};

export const getContentFontSettings = async (): Promise<{
  runtimeConfig: ContentFontRuntimeConfig;
  settings: ContentFontSettingsDocument;
}> => {
  const runtimeConfig = await getContentFontRuntimeConfig();
  const mainDatabaseName = getMainDatabaseName();
  const mainSettingsDocumentId = getMainSettingsDocumentId();
  const contentDatabaseName = getContentDatabaseName();

  const [mainSettingsDocument, legacySettingsDocument] = await Promise.all([
    getDocument<MainSettingsDocument>(mainDatabaseName, mainSettingsDocumentId),
    getDocument(contentDatabaseName, CONTENT_FONT_SETTINGS_DOC_ID),
  ]);

  const storedMainSettings = getContentFontSettingsFromMainSettings(mainSettingsDocument);
  const existing = storedMainSettings
    ? {
        ...storedMainSettings,
        _rev: mainSettingsDocument?._rev,
      }
    : legacySettingsDocument;

  return {
    runtimeConfig,
    settings: normalizeSettingsDocument(existing, runtimeConfig),
  };
};

export const saveContentFontSettings = async (payload: {
  sansFamily?: unknown;
  displayFamily?: unknown;
  styles?: unknown;
  weights?: unknown;
  widths?: unknown;
  updatedBy?: string | null;
}): Promise<{ runtimeConfig: ContentFontRuntimeConfig; settings: ContentFontSettingsDocument }> => {
  const { runtimeConfig, settings } = await getContentFontSettings();
  const allowlist = runtimeConfig.allowlist.map((entry) => entry.slug);

  const requestedSans = normalizeSlug(payload.sansFamily);
  const requestedDisplay = normalizeSlug(payload.displayFamily);
  if (requestedSans && !allowlist.includes(requestedSans)) {
    throw createError({
      statusCode: 400,
      statusMessage: `Sans family "${requestedSans}" is not allowlisted.`,
    });
  }
  if (requestedDisplay && !allowlist.includes(requestedDisplay)) {
    throw createError({
      statusCode: 400,
      statusMessage: `Display family "${requestedDisplay}" is not allowlisted.`,
    });
  }

  const nextSans = ensureAllowedFamily(payload.sansFamily, allowlist, settings.sansFamily);
  const nextDisplay = ensureAllowedFamily(
    payload.displayFamily,
    allowlist,
    settings.displayFamily,
  );

  if (!allowlist.includes(nextSans) || !allowlist.includes(nextDisplay)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Selected font family is not allowed.",
    });
  }

  const nextDoc: ContentFontSettingsDocument = {
    ...settings,
    sansFamily: nextSans,
    displayFamily: nextDisplay,
    styles: normalizeStyles(payload.styles).length > 0
      ? normalizeStyles(payload.styles)
      : settings.styles,
    weights: normalizeWeights(payload.weights).length > 0
      ? normalizeWeights(payload.weights)
      : settings.weights,
    widths: normalizeWidths(payload.widths).length > 0
      ? normalizeWidths(payload.widths)
      : settings.widths,
    updatedAt: nowIso(),
    updatedBy: payload.updatedBy ?? null,
  };

  const databaseName = getMainDatabaseName();
  const settingsDocumentId = getMainSettingsDocumentId();
  const existingMainSettings = await getDocument<MainSettingsDocument>(
    databaseName,
    settingsDocumentId,
  );
  const nextMainSettings = mergeContentFontSettingsIntoMainSettings(
    existingMainSettings ?? { _id: settingsDocumentId },
    nextDoc,
  );
  const putResponse = await putDocument(databaseName, nextMainSettings);
  if (putResponse.rev) {
    nextDoc._rev = putResponse.rev;
  }

  return {
    runtimeConfig,
    settings: nextDoc,
  };
};

export const parseBunnyFontFaces = (cssText: string): ParsedBunnyFontFace[] => {
  const faces: ParsedBunnyFontFace[] = [];
  const regex = /\/\*\s*([^*]+?)\s*\*\/\s*@font-face\s*\{([\s\S]*?)\}/g;
  let match: RegExpExecArray | null = regex.exec(cssText);

  while (match) {
    const subset = match[1]?.trim().toLowerCase() || null;
    const body = match[2] ?? "";

    const familyMatch = /font-family:\s*['"]([^'"]+)['"]\s*;/i.exec(body);
    const styleMatch = /font-style:\s*(normal|italic)\s*;/i.exec(body);
    const weightMatch = /font-weight:\s*(\d+)\s*;/i.exec(body);
    const stretchMatch = /font-stretch:\s*([^;]+)\s*;/i.exec(body);
    const unicodeRangeMatch = /unicode-range:\s*([^;]+)\s*;/i.exec(body);
    const sourceMatch = /src:\s*([^;]+)\s*;/i.exec(body);
    const remoteUrlMatch = sourceMatch?.[1]
      ? /url\((https?:\/\/[^)]+\.woff2)\)/i.exec(sourceMatch[1])
      : null;

    const style = styleMatch?.[1]?.toLowerCase() as ContentFontStyle | undefined;
    const weight = weightMatch ? Number(weightMatch[1]) : NaN;

    if (
      familyMatch?.[1] &&
      style &&
      FONT_STYLE_VALUES.includes(style) &&
      Number.isFinite(weight) &&
      remoteUrlMatch?.[1]
    ) {
      faces.push({
        family: familyMatch[1],
        subset,
        style,
        weight,
        stretch: normalizeWidthValue(stretchMatch?.[1]) ?? "100%",
        unicodeRange: unicodeRangeMatch?.[1]?.trim() ?? null,
        remoteUrl: remoteUrlMatch[1].trim(),
      });
    }

    match = regex.exec(cssText);
  }

  return faces;
};

export const filterBunnyFontFaces = (
  faces: ParsedBunnyFontFace[],
  profile: { styles: ContentFontStyle[]; weights: number[]; widths: ContentFontWidth[] },
): ParsedBunnyFontFace[] => {
  const requestedStyles = new Set(profile.styles);
  const requestedWeights = new Set(profile.weights);
  const requestedWidths = new Set(profile.widths);
  const byCombo = new Map<string, ParsedBunnyFontFace[]>();

  for (const face of faces) {
    if (
      !requestedStyles.has(face.style) ||
      !requestedWeights.has(face.weight) ||
      !requestedWidths.has(face.stretch)
    ) {
      continue;
    }
    const combo = `${face.style}:${face.weight}:${face.stretch}`;
    const entries = byCombo.get(combo) ?? [];
    entries.push(face);
    byCombo.set(combo, entries);
  }

  const selected: ParsedBunnyFontFace[] = [];
  for (const style of profile.styles) {
    for (const weight of profile.weights) {
      for (const width of profile.widths) {
        const combo = `${style}:${weight}:${width}`;
        const options = byCombo.get(combo) ?? [];
        if (options.length === 0) {
          continue;
        }

        const latinOnly = options.filter((entry) => entry.subset === "latin");
        selected.push(...(latinOnly.length > 0 ? latinOnly : options));
      }
    }
  }

  const dedup = new Map<string, ParsedBunnyFontFace>();
  for (const face of selected) {
    dedup.set(face.remoteUrl, face);
  }
  return Array.from(dedup.values());
};

const buildBunnyCssUrl = (familySlug: string, styles: ContentFontStyle[], weights: number[]) => {
  const styleSet = new Set(styles);
  const variants: string[] = [];
  for (const weight of weights) {
    if (styleSet.has("normal")) {
      variants.push(String(weight));
    }
    if (styleSet.has("italic")) {
      variants.push(`${weight}i`);
    }
  }
  const query = variants.join(",");
  return `https://fonts.bunny.net/css?family=${encodeURIComponent(familySlug)}:${query}`;
};

const ensureManagedFontsDirectory = async () => {
  const rootDir = join(process.cwd(), "public", MANAGED_FONTS_DIR);
  await fs.mkdir(rootDir, { recursive: true });
  return rootDir;
};

const toPublicFontUrl = (relativePath: string) =>
  `/${MANAGED_FONTS_DIR}/${relativePath.replace(/\\/g, "/").replace(/^\/+/, "")}`;

const downloadRemoteFont = async (remoteUrl: string, targetPath: string) => {
  const response = await fetch(remoteUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch font file: ${remoteUrl}`);
  }
  const data = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(targetPath, data);
};

const materializeFamilyFaces = async (
  familySlug: string,
  styles: ContentFontStyle[],
  weights: number[],
  widths: ContentFontWidth[],
  downloadRoot: string,
): Promise<ParsedBunnyFontFace[]> => {
  const cssUrl = buildBunnyCssUrl(familySlug, styles, weights);
  const response = await fetch(cssUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch Bunny stylesheet for ${familySlug}`);
  }

  const cssText = await response.text();
  const parsedFaces = parseBunnyFontFaces(cssText);
  const selectedFaces = filterBunnyFontFaces(parsedFaces, { styles, weights, widths });

  if (selectedFaces.length === 0) {
    throw new Error(`No matching Bunny font faces found for ${familySlug}`);
  }

  const familyDir = join(downloadRoot, familySlug);
  await fs.mkdir(familyDir, { recursive: true });

  for (const face of selectedFaces) {
    const remoteName = basename(new URL(face.remoteUrl).pathname);
    const suffix = createHash("sha1").update(face.remoteUrl).digest("hex").slice(0, 10);
    const localName = `${remoteName.replace(/\.woff2$/i, "")}-${suffix}.woff2`;
    const targetPath = join(familyDir, localName);
    await downloadRemoteFont(face.remoteUrl, targetPath);
    face.remoteUrl = toPublicFontUrl(`${familySlug}/${localName}`);
  }

  return selectedFaces;
};

const renderRuntimeCss = (payload: {
  sansLabel: string;
  displayLabel: string;
  facesByFamily: Record<string, ParsedBunnyFontFace[]>;
}) => {
  const chunks: string[] = [
    "/* Generated by content font manager */",
  ];

  for (const [family, faces] of Object.entries(payload.facesByFamily)) {
    chunks.push(`/* ${family} */`);
    for (const face of faces) {
      chunks.push("@font-face {");
      chunks.push(`  font-family: '${family}';`);
      chunks.push(`  font-style: ${face.style};`);
      chunks.push(`  font-weight: ${face.weight};`);
      chunks.push(`  font-stretch: ${face.stretch};`);
      chunks.push("  font-display: swap;");
      chunks.push(`  src: url('${face.remoteUrl}') format('woff2');`);
      if (face.unicodeRange) {
        chunks.push(`  unicode-range: ${face.unicodeRange};`);
      }
      chunks.push("}");
    }
  }

  chunks.push(":root {");
  chunks.push(`  --font-sans: '${payload.sansLabel}', sans-serif;`);
  chunks.push(`  --font-display: '${payload.displayLabel}', serif;`);
  chunks.push("}");
  chunks.push("");

  return chunks.join("\n");
};

const writeRuntimeCss = async (cssText: string) => {
  const managedRoot = await ensureManagedFontsDirectory();
  const runtimeCssPath = join(managedRoot, RUNTIME_FONTS_FILE_NAME);
  await fs.writeFile(runtimeCssPath, cssText, "utf8");
  return runtimeCssPath;
};

const pruneManagedFontsDirectory = async (
  managedRoot: string,
  activeFamilies: string[],
) => {
  const activeFamilySet = new Set(activeFamilies);
  const entries = await fs.readdir(managedRoot, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = join(managedRoot, entry.name);

    if (entry.isDirectory()) {
      if (entry.name.startsWith(".tmp-")) {
        await fs.rm(entryPath, { recursive: true, force: true });
        continue;
      }
      if (!activeFamilySet.has(entry.name)) {
        await fs.rm(entryPath, { recursive: true, force: true });
      }
      continue;
    }

    if (entry.isFile() && entry.name !== RUNTIME_FONTS_FILE_NAME) {
      await fs.rm(entryPath, { force: true });
    }
  }
};

const upsertManagedAssetsCss = async (cssText: string) => {
  const assetsFontsPath = join(process.cwd(), "app", "assets", "css", "fonts.css");
  const managedBlock = `${MANAGED_ASSETS_START}\n${cssText.trim()}\n${MANAGED_ASSETS_END}\n`;

  let existing = "";
  try {
    existing = await fs.readFile(assetsFontsPath, "utf8");
  } catch {
    await fs.mkdir(join(process.cwd(), "app", "assets", "css"), { recursive: true });
  }

  if (!existing.trim()) {
    await fs.writeFile(assetsFontsPath, `${managedBlock}`, "utf8");
    return;
  }

  const startIndex = existing.indexOf(MANAGED_ASSETS_START);
  const endIndex = existing.indexOf(MANAGED_ASSETS_END);
  if (startIndex >= 0 && endIndex > startIndex) {
    const before = existing.slice(0, startIndex).trimEnd();
    const after = existing.slice(endIndex + MANAGED_ASSETS_END.length).trimStart();
    const next = `${before}\n\n${managedBlock}\n${after}`.trim() + "\n";
    await fs.writeFile(assetsFontsPath, next, "utf8");
    return;
  }

  const next = `${existing.trimEnd()}\n\n${managedBlock}`;
  await fs.writeFile(assetsFontsPath, next, "utf8");
};

export const applyContentFonts = async (payload: {
  updatedBy?: string | null;
}): Promise<{ runtimeConfig: ContentFontRuntimeConfig; settings: ContentFontSettingsDocument }> => {
  const { runtimeConfig, settings } = await getContentFontSettings();
  const allowlist = runtimeConfig.allowlist.map((entry) => entry.slug);

  if (!allowlist.includes(settings.sansFamily) || !allowlist.includes(settings.displayFamily)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Configured font families are outside the allowlist.",
    });
  }

  const nextStatusBase: ContentFontSettingsDocument = {
    ...settings,
    updatedAt: nowIso(),
    updatedBy: payload.updatedBy ?? null,
  };

  try {
    const managedRoot = await ensureManagedFontsDirectory();
    const stagingRoot = join(managedRoot, `.tmp-${Date.now()}`);
    await fs.mkdir(stagingRoot, { recursive: true });

    const familiesToMaterialize = Array.from(
      new Set([settings.sansFamily, settings.displayFamily]),
    );
    const facesByFamilySlug: Record<string, ParsedBunnyFontFace[]> = {};
    for (const familySlug of familiesToMaterialize) {
      facesByFamilySlug[familySlug] = await materializeFamilyFaces(
        familySlug,
        settings.styles,
        settings.weights,
        settings.widths,
        stagingRoot,
      );
    }

    for (const familySlug of familiesToMaterialize) {
      const finalDir = join(managedRoot, familySlug);
      const stagedDir = join(stagingRoot, familySlug);
      await fs.rm(finalDir, { recursive: true, force: true });
      await fs.rename(stagedDir, finalDir);
    }
    await fs.rm(stagingRoot, { recursive: true, force: true });
    await pruneManagedFontsDirectory(managedRoot, familiesToMaterialize);

    const familyLabels = Object.fromEntries(
      familiesToMaterialize.map((entry) => [entry, toFontFamilyLabel(entry)]),
    );
    const facesByLabel: Record<string, ParsedBunnyFontFace[]> = {};
    for (const familySlug of familiesToMaterialize) {
      const label = familyLabels[familySlug];
      facesByLabel[label] = facesByFamilySlug[familySlug] ?? [];
    }

    const runtimeCss = renderRuntimeCss({
      sansLabel: familyLabels[settings.sansFamily] ?? toFontFamilyLabel(settings.sansFamily),
      displayLabel:
        familyLabels[settings.displayFamily] ?? toFontFamilyLabel(settings.displayFamily),
      facesByFamily: facesByLabel,
    });
    await writeRuntimeCss(runtimeCss);
    await upsertManagedAssetsCss(runtimeCss);

    const nextDoc: ContentFontSettingsDocument = {
      ...nextStatusBase,
      status: "applied",
      lastApplyError: null,
      lastAppliedAt: nowIso(),
      lastAppliedBy: payload.updatedBy ?? null,
      runtimeCssVersion: Date.now(),
      runtimeCssPath: `/${MANAGED_FONTS_DIR}/${RUNTIME_FONTS_FILE_NAME}`,
    };

    const databaseName = getMainDatabaseName();
    const settingsDocumentId = getMainSettingsDocumentId();
    const existingMainSettings = await getDocument<MainSettingsDocument>(
      databaseName,
      settingsDocumentId,
    );
    const nextMainSettings = mergeContentFontSettingsIntoMainSettings(
      existingMainSettings ?? { _id: settingsDocumentId },
      nextDoc,
    );
    const putResponse = await putDocument(databaseName, nextMainSettings);
    if (putResponse.rev) {
      nextDoc._rev = putResponse.rev;
    }

    return {
      runtimeConfig,
      settings: nextDoc,
    };
  } catch (error: any) {
    const managedRoot = await ensureManagedFontsDirectory();
    const entries = await fs.readdir(managedRoot, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name.startsWith(".tmp-")) {
        await fs.rm(join(managedRoot, entry.name), { recursive: true, force: true });
      }
    }

    const databaseName = getMainDatabaseName();
    const settingsDocumentId = getMainSettingsDocumentId();
    const failedDoc: ContentFontSettingsDocument = {
      ...nextStatusBase,
      status: "failed",
      lastApplyError: error?.message ? String(error.message) : "Unknown apply error",
    };
    const existingMainSettings = await getDocument<MainSettingsDocument>(
      databaseName,
      settingsDocumentId,
    );
    const failedMainSettings = mergeContentFontSettingsIntoMainSettings(
      existingMainSettings ?? { _id: settingsDocumentId },
      failedDoc,
    );
    const putResponse = await putDocument(databaseName, failedMainSettings);
    if (putResponse.rev) {
      failedDoc._rev = putResponse.rev;
    }

    throw createError({
      statusCode: 500,
      statusMessage: failedDoc.lastApplyError ?? "Failed to apply fonts.",
    });
  }
};

export const getRuntimeFontCss = async (): Promise<string> => {
  const runtimeCssPath = join(process.cwd(), "public", MANAGED_FONTS_DIR, RUNTIME_FONTS_FILE_NAME);
  try {
    return await fs.readFile(runtimeCssPath, "utf8");
  } catch {
    const { settings } = await getContentFontSettings();
    return [
      "/* Fallback runtime font variables */",
      ":root {",
      `  --font-sans: '${toFontFamilyLabel(settings.sansFamily)}', sans-serif;`,
      `  --font-display: '${toFontFamilyLabel(settings.displayFamily)}', serif;`,
      "}",
      "",
    ].join("\n");
  }
};
