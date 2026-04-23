import { createError } from "h3";
import {
  buildCouchEnvSection,
  normalizeCouchEnvSlug,
  readCouchConfigValues,
} from "#database/utils/couch-config";
import {
  deleteAttachment,
  getDocument,
  getDocumentWithAttachments,
  putAttachment,
  putDocument,
  type CouchDBDocument,
  type CouchDBDocumentWithAttachments,
} from "#database/utils/couchdb";
import {
  getContentDatabaseName,
  getMainDatabaseName,
  getMainSettingsDocumentId,
} from "./database";

/**
 * Content-layer runtime font manager.
 *
 * @remarks
 * This module centralizes the font lifecycle used by runtime pages and the admin builder:
 * - reads tenant-level allowlist/defaults from CouchDB `_config`,
 * - persists selected font profile in `content-settings:fonts`,
 * - stores binary `.woff2` assets as CouchDB attachments in `content-settings:font-assets`,
 * - renders deterministic runtime CSS consumed by `/api/content/fonts/runtime.css`,
 * - resolves stable, attachment-backed asset URLs for preload/active endpoints.
 *
 * Design intent:
 * - keep runtime behavior consistent across dev/prod without filesystem coupling,
 * - keep one canonical source of truth in CouchDB,
 * - allow cautious migration by still reading legacy main-settings font payloads.
 */
export const CONTENT_FONT_SETTINGS_DOC_ID = "content-settings:fonts";
export const CONTENT_FONT_ASSETS_DOC_ID = "content-settings:font-assets";

/** Public URL serving the generated runtime CSS payload. */
const RUNTIME_CSS_PUBLIC_PATH = "/api/content/fonts/runtime.css";
/** MIME type used for persisted font attachments. */
const FONT_ASSET_CONTENT_TYPE = "font/woff2";
/** Public URL prefix used by attachment-backed font asset routes. */
const FONT_ASSET_API_PREFIX = "/api/content/fonts/asset/";

const ALLOWLIST_CONFIG_KEY = "content_fonts_allowlist";
const DEFAULT_SANS_CONFIG_KEY = "content_fonts_default_sans";
const DEFAULT_DISPLAY_CONFIG_KEY = "content_fonts_default_display";

const DEFAULT_ALLOWLIST = ["inter", "lato", "playfair-display"];
const DEFAULT_PROFILE_WEIGHTS = [300, 400, 700] as const;
const DEFAULT_PROFILE_STYLES = ["normal", "italic"] as const;
const DEFAULT_PROFILE_WIDTHS = ["100%"] as const;

const FONT_STYLE_VALUES = ["normal", "italic"] as const;
export type ContentFontStyle = (typeof FONT_STYLE_VALUES)[number];
export type ContentFontWidth = string;

/** A selectable family exposed to builder UI clients. */
export interface ContentFontFamilyOption {
  slug: string;
  label: string;
}

/**
 * `@font-face` variant parsed from BunnyCSS response.
 *
 * @remarks
 * `remoteUrl` initially points to Bunny-hosted files, then is rewritten to local
 * attachment-backed URLs during apply/sync.
 */
export interface ParsedBunnyFontFace {
  family: string;
  subset: string | null;
  style: ContentFontStyle;
  weight: number;
  stretch: ContentFontWidth;
  unicodeRange: string | null;
  remoteUrl: string;
}

/** `@font-face` variant parsed from the generated runtime CSS. */
export interface ParsedRuntimeFontFace {
  family: string;
  style: ContentFontStyle;
  weight: number;
  stretch: ContentFontWidth;
  publicUrl: string;
}

/** Parsed `:root` runtime variables used to infer active sans/display families. */
export interface RuntimeFontVariables {
  sansLabel: string | null;
  displayLabel: string | null;
  sansSlug: string | null;
  displaySlug: string | null;
}

/**
 * Canonical settings document for content-layer fonts.
 *
 * @remarks
 * Stored in the content database under `content-settings:fonts`.
 * `runtimeCssText` is intentionally persisted so runtime rendering does not depend
 * on local disk artifacts or build-time assets.
 */
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
  runtimeCssText: string | null;
  runtimeAssetMode: "attachment";
  updatedAt: string;
  updatedBy: string | null;
}

/** Attachment container document for binary runtime font files. */
interface ContentFontAssetsDocument extends CouchDBDocumentWithAttachments {
  _id: typeof CONTENT_FONT_ASSETS_DOC_ID;
  type: "content-font-assets";
  activeAttachmentNames: string[];
  updatedAt: string;
  updatedBy: string | null;
}

/**
 * Runtime config resolved from CouchDB `_config`.
 *
 * @remarks
 * This is tenant-aware via `cf_env_<appSlug>` and governs what families users are
 * allowed to pick in admin.
 */
export interface ContentFontRuntimeConfig {
  slug: string;
  section: string;
  allowlist: ContentFontFamilyOption[];
  defaultSans: string;
  defaultDisplay: string;
}

/** Legacy host-app main settings shape used only as migration fallback read. */
interface MainSettingsDocument extends CouchDBDocument {
  _id: string;
  contentFonts?: Partial<ContentFontSettingsDocument>;
  [key: string]: unknown;
}

/** Timestamp helper for persisted audit fields. */
const nowIso = () => new Date().toISOString();

/** Normalize arbitrary labels/slugs to a strict lowercase kebab-case identifier. */
const normalizeSlug = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-");
  const cleaned = normalized.replace(/-+/g, "-").replace(/^-+|-+$/g, "");
  return cleaned.length > 0 ? cleaned : null;
};

/** Convert a slug (`playfair-display`) to human label (`Playfair Display`). */
export const toFontFamilyLabel = (slug: string): string =>
  slug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

/**
 * Resolve app slug used to address tenant CouchDB `_config` values.
 *
 * @remarks
 * Prefers `runtimeConfig.public.appSlug` so server/runtime environments stay stable,
 * with cwd fallback only as a defensive default.
 */
export const resolveContentFontRuntimeSlug = (
  runtimeConfig: Record<string, any> | null | undefined,
  fallbackCwdName = process.cwd().split("/").filter(Boolean).pop() ?? "app",
): string => {
  const explicit = runtimeConfig?.public?.appSlug;
  if (typeof explicit === "string" && explicit.trim().length > 0) {
    return normalizeCouchEnvSlug(explicit) || "app";
  }

  return normalizeCouchEnvSlug(fallbackCwdName) || "app";
};

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

/** Resolve effective default sans/display slugs from config + allowlist with safe fallbacks. */
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

/**
 * Read runtime allowlist/defaults from CouchDB `_config`.
 *
 * @remarks
 * API handlers call this on demand so admin and runtime views share the same source.
 */
export const getContentFontRuntimeConfig = async (): Promise<ContentFontRuntimeConfig> => {
  const runtimeConfig = useRuntimeConfig();
  const cwdName = process.cwd().split("/").filter(Boolean).pop() ?? "app";
  const slug = resolveContentFontRuntimeSlug(runtimeConfig, cwdName);
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

/** Normalize user-provided style list into unique allowed enum values. */
const normalizeStyles = (value: unknown): ContentFontStyle[] => {
  const source = Array.isArray(value) ? value : [];
  const normalized = source
    .map((entry) => (typeof entry === "string" ? entry.trim().toLowerCase() : ""))
    .filter((entry): entry is ContentFontStyle =>
      FONT_STYLE_VALUES.includes(entry as ContentFontStyle),
    );
  return Array.from(new Set(normalized));
};

/** Normalize and clamp user-provided weight list to CSS 100..900 steps. */
const normalizeWeights = (value: unknown): number[] => {
  const source = Array.isArray(value) ? value : [];
  const normalized = source
    .map((entry) => Number(entry))
    .filter((entry) => Number.isFinite(entry))
    .map((entry) => Math.max(100, Math.min(900, Math.round(entry / 100) * 100)));
  return Array.from(new Set(normalized)).sort((a, b) => a - b);
};

/** Parse numeric width component from a width token (for example `"125%"`). */
const parseWidthNumber = (value: string): number | null => {
  const numeric = Number.parseFloat(value);
  return Number.isFinite(numeric) ? numeric : null;
};

/** Comparator for width tokens, numeric-aware when possible. */
const compareWidths = (left: string, right: string) => {
  const leftValue = parseWidthNumber(left);
  const rightValue = parseWidthNumber(right);

  if (leftValue !== null && rightValue !== null) {
    return leftValue - rightValue;
  }

  return left.localeCompare(right);
};

/** Normalize width input into percentage-form token expected by CSS (`"100%"`). */
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

/** Parse a `--font-*` variable from runtime CSS and return its first declared family label. */
const parseRuntimeRootFontLabel = (
  cssText: string,
  variableName: "font-sans" | "font-display",
): string | null => {
  const variableRegex = new RegExp(`--${variableName}\\s*:\\s*([^;]+);`, "i");
  const match = variableRegex.exec(cssText);
  if (!match?.[1]) {
    return null;
  }

  const rawValue = match[1].trim();
  if (!rawValue) {
    return null;
  }

  const firstToken = rawValue.split(",")[0]?.trim() ?? "";
  if (!firstToken) {
    return null;
  }

  const label = firstToken.replace(/^['"]|['"]$/g, "").trim();
  return label.length > 0 ? label : null;
};

/** Parse `--font-sans` and `--font-display` variables and normalized slugs from runtime CSS. */
export const parseRuntimeFontVariables = (cssText: string): RuntimeFontVariables => {
  const sansLabel = parseRuntimeRootFontLabel(cssText, "font-sans");
  const displayLabel = parseRuntimeRootFontLabel(cssText, "font-display");

  return {
    sansLabel,
    displayLabel,
    sansSlug: normalizeSlug(sansLabel),
    displaySlug: normalizeSlug(displayLabel),
  };
};

/** Normalize user-provided width list into sorted unique CSS width tokens. */
const normalizeWidths = (value: unknown): ContentFontWidth[] => {
  const source = Array.isArray(value) ? value : [];
  const normalized = source
    .map((entry) => normalizeWidthValue(entry))
    .filter((entry): entry is ContentFontWidth => Boolean(entry));
  return Array.from(new Set(normalized)).sort(compareWidths);
};

/** Build default settings document from runtime config defaults. */
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
    runtimeCssPath: RUNTIME_CSS_PUBLIC_PATH,
    runtimeCssText: null,
    runtimeAssetMode: "attachment",
    updatedAt: timestamp,
    updatedBy: null,
  };
};

/** Ensure selected family is allowlisted; otherwise return fallback slug. */
const ensureAllowedFamily = (candidate: unknown, allowlist: string[], fallback: string) => {
  const normalized = normalizeSlug(candidate);
  if (!normalized) {
    return fallback;
  }
  return allowlist.includes(normalized) ? normalized : fallback;
};

/** Normalize arbitrary persisted payload into strict `ContentFontSettingsDocument` shape. */
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
    runtimeCssText:
      typeof source.runtimeCssText === "string" && source.runtimeCssText.trim()
        ? source.runtimeCssText
        : null,
    runtimeAssetMode: "attachment",
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

/** Read legacy `contentFonts` payload from host main settings doc when present. */
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

/**
 * Merge runtime config with families discovered from runtime CSS.
 *
 * @remarks
 * This keeps admin selectors compatible with already-applied fonts that may no longer
 * exist in current `_config` allowlist, avoiding abrupt UI resets.
 */
const mergeRuntimeConfigWithRuntimeCss = (
  runtimeConfig: ContentFontRuntimeConfig,
  runtimeCss: string,
): ContentFontRuntimeConfig => {
  const mergedAllowlist = new Map<string, ContentFontFamilyOption>();
  for (const entry of runtimeConfig.allowlist) {
    mergedAllowlist.set(entry.slug, entry);
  }

  const addFamilyOption = (label: string | null) => {
    const slug = normalizeSlug(label);
    if (!slug || mergedAllowlist.has(slug)) {
      return;
    }
    mergedAllowlist.set(slug, {
      slug,
      label: label?.trim() || toFontFamilyLabel(slug),
    });
  };

  const runtimeVariables = parseRuntimeFontVariables(runtimeCss);
  addFamilyOption(runtimeVariables.sansLabel);
  addFamilyOption(runtimeVariables.displayLabel);

  const runtimeFaces = parseRuntimeFontFaces(runtimeCss);
  for (const face of runtimeFaces) {
    addFamilyOption(face.family);
  }

  const defaultSans =
    runtimeVariables.sansSlug && mergedAllowlist.has(runtimeVariables.sansSlug)
      ? runtimeVariables.sansSlug
      : runtimeConfig.defaultSans;
  const defaultDisplay =
    runtimeVariables.displaySlug && mergedAllowlist.has(runtimeVariables.displaySlug)
      ? runtimeVariables.displaySlug
      : runtimeConfig.defaultDisplay;

  return {
    ...runtimeConfig,
    allowlist: Array.from(mergedAllowlist.values()),
    defaultSans,
    defaultDisplay,
  };
};

/** Detect whether a persisted payload explicitly stores family selections. */
const hasStoredFamilySelection = (value: unknown): boolean => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const source = value as Record<string, unknown>;
  return Boolean(normalizeSlug(source.sansFamily) && normalizeSlug(source.displayFamily));
};

/**
 * Retrieve effective font settings and runtime config for current tenant.
 *
 * @remarks
 * Read order:
 * 1) canonical content DB settings doc,
 * 2) legacy host main-settings payload (migration fallback),
 * then normalized against current runtime config.
 */
export const getContentFontSettings = async (): Promise<{
  runtimeConfig: ContentFontRuntimeConfig;
  settings: ContentFontSettingsDocument;
}> => {
  const runtimeConfig = await getContentFontRuntimeConfig();
  const contentDatabaseName = getContentDatabaseName();
  const mainDatabaseName = getMainDatabaseName();
  const mainSettingsDocumentId = getMainSettingsDocumentId();

  const [contentSettingsDocument, mainSettingsDocument] = await Promise.all([
    getDocument<ContentFontSettingsDocument>(contentDatabaseName, CONTENT_FONT_SETTINGS_DOC_ID),
    getDocument<MainSettingsDocument>(mainDatabaseName, mainSettingsDocumentId),
  ]);

  const storedMainSettings = getContentFontSettingsFromMainSettings(mainSettingsDocument);
  const existing = contentSettingsDocument ?? storedMainSettings ?? null;

  const hasPersistedFamilySelection = hasStoredFamilySelection(existing);
  const initialSettings = normalizeSettingsDocument(existing, runtimeConfig);
  const runtimeCssForSync =
    initialSettings.runtimeCssText && initialSettings.runtimeCssText.trim().length > 0
      ? initialSettings.runtimeCssText
      : null;

  const effectiveRuntimeConfig = runtimeCssForSync
    ? mergeRuntimeConfigWithRuntimeCss(runtimeConfig, runtimeCssForSync)
    : runtimeConfig;

  let normalizedSettings = normalizeSettingsDocument(
    existing ?? initialSettings,
    effectiveRuntimeConfig,
  );

  if (runtimeCssForSync && !hasPersistedFamilySelection) {
    const runtimeVariables = parseRuntimeFontVariables(runtimeCssForSync);
    const allowlist = new Set(
      effectiveRuntimeConfig.allowlist.map((entry) => entry.slug),
    );

    if (runtimeVariables.sansSlug && allowlist.has(runtimeVariables.sansSlug)) {
      normalizedSettings = {
        ...normalizedSettings,
        sansFamily: runtimeVariables.sansSlug,
      };
    }

    if (runtimeVariables.displaySlug && allowlist.has(runtimeVariables.displaySlug)) {
      normalizedSettings = {
        ...normalizedSettings,
        displayFamily: runtimeVariables.displaySlug,
      };
    }
  }

  return {
    runtimeConfig: effectiveRuntimeConfig,
    settings: normalizedSettings,
  };
};

/** Persist canonical font settings document to content DB with optimistic revision update. */
const persistContentFontSettingsDocument = async (
  settings: ContentFontSettingsDocument,
): Promise<ContentFontSettingsDocument> => {
  const databaseName = getContentDatabaseName();
  const existing = await getDocument<ContentFontSettingsDocument>(
    databaseName,
    CONTENT_FONT_SETTINGS_DOC_ID,
  );

  const nextDocument: ContentFontSettingsDocument = {
    ...settings,
    _id: CONTENT_FONT_SETTINGS_DOC_ID,
    type: "content-font-settings",
    _rev: existing?._rev,
  };

  if (!nextDocument._rev) {
    delete nextDocument._rev;
  }

  const putResponse = await putDocument(databaseName, nextDocument);
  if (putResponse.rev) {
    nextDocument._rev = putResponse.rev;
  }

  return nextDocument;
};

/**
 * Save admin-selected font profile (does not download/apply binary assets).
 *
 * @remarks
 * This endpoint validates allowlist constraints and updates selection metadata only.
 * Binary download and CSS generation happen in `applyContentFonts`.
 */
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
  const persistedDoc = await persistContentFontSettingsDocument(nextDoc);

  return {
    runtimeConfig,
    settings: persistedDoc,
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

/** Parse runtime CSS into local `@font-face` variants (attachment-backed URLs). */
export const parseRuntimeFontFaces = (cssText: string): ParsedRuntimeFontFace[] => {
  const faces: ParsedRuntimeFontFace[] = [];
  const regex = /@font-face\s*\{([\s\S]*?)\}/g;
  let match: RegExpExecArray | null = regex.exec(cssText);

  while (match) {
    const body = match[1] ?? "";
    const familyMatch = /font-family:\s*['"]([^'"]+)['"]\s*;/i.exec(body);
    const styleMatch = /font-style:\s*(normal|italic)\s*;/i.exec(body);
    const weightMatch = /font-weight:\s*(\d+)\s*;/i.exec(body);
    const stretchMatch = /font-stretch:\s*([^;]+)\s*;/i.exec(body);
    const srcMatch = /src:\s*([^;]+)\s*;/i.exec(body);
    const fontUrlMatch = srcMatch?.[1]
      ? /url\((['"]?)([^'")]+\.woff2)\1\)/i.exec(srcMatch[1])
      : null;

    const style = styleMatch?.[1]?.toLowerCase() as ContentFontStyle | undefined;
    const weight = weightMatch ? Number(weightMatch[1]) : NaN;
    const stretch = normalizeWidthValue(stretchMatch?.[1]) ?? "100%";

    if (
      familyMatch?.[1] &&
      style &&
      FONT_STYLE_VALUES.includes(style) &&
      Number.isFinite(weight) &&
      fontUrlMatch?.[2]
    ) {
      faces.push({
        family: familyMatch[1].trim(),
        style,
        weight,
        stretch,
        publicUrl: fontUrlMatch[2].trim(),
      });
    }

    match = regex.exec(cssText);
  }

  return faces;
};

/** Find exact runtime face match by family/style/weight (+ optional preferred stretch). */
export const findRuntimeFontFace = (
  faces: ParsedRuntimeFontFace[],
  payload: {
    family: string;
    style: ContentFontStyle;
    weight: number;
    stretch?: ContentFontWidth;
  },
): ParsedRuntimeFontFace | null => {
  const family = payload.family.trim().toLowerCase();
  const preferredStretch = normalizeWidthValue(payload.stretch) ?? "100%";

  const candidates = faces.filter(
    (face) =>
      face.family.trim().toLowerCase() === family &&
      face.style === payload.style &&
      face.weight === payload.weight,
  );

  if (candidates.length === 0) {
    return null;
  }

  const exactStretch = candidates.find((face) => face.stretch === preferredStretch);
  if (exactStretch) {
    return exactStretch;
  }

  const defaultStretch = candidates.find((face) => face.stretch === "100%");
  if (defaultStretch) {
    return defaultStretch;
  }

  return [...candidates].sort((left, right) => compareWidths(left.stretch, right.stretch))[0] ?? null;
};

/**
 * Filter Bunny faces to only the requested style/weight/width profile.
 *
 * @remarks
 * Prefers latin subset when available for each requested combination, reducing payload.
 */
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

/** Build BunnyCSS API URL for selected family and style/weight combinations. */
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

/** Resolve filtered Bunny faces for a specific family/profile request. */
const resolveRemoteFamilyFaces = async (
  familySlug: string,
  styles: ContentFontStyle[],
  weights: number[],
  widths: ContentFontWidth[],
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

  return selectedFaces;
};

/** Ensure attachment container document exists before asset sync starts. */
const ensureFontAssetsDocument = async (payload: {
  databaseName: string;
  updatedBy?: string | null;
}): Promise<ContentFontAssetsDocument> => {
  const existing = await getDocumentWithAttachments<ContentFontAssetsDocument>(
    payload.databaseName,
    CONTENT_FONT_ASSETS_DOC_ID,
    false,
  );

  if (existing && existing.type === "content-font-assets") {
    return {
      ...existing,
      _id: CONTENT_FONT_ASSETS_DOC_ID,
      type: "content-font-assets",
      activeAttachmentNames: Array.isArray(existing.activeAttachmentNames)
        ? existing.activeAttachmentNames
        : [],
      updatedAt:
        typeof existing.updatedAt === "string" && existing.updatedAt.trim()
          ? existing.updatedAt
          : nowIso(),
      updatedBy:
        typeof existing.updatedBy === "string" && existing.updatedBy.trim()
          ? existing.updatedBy
          : null,
    };
  }

  const nextDoc: ContentFontAssetsDocument = {
    _id: CONTENT_FONT_ASSETS_DOC_ID,
    type: "content-font-assets",
    activeAttachmentNames: [],
    updatedAt: nowIso(),
    updatedBy: payload.updatedBy ?? null,
  };
  const putResponse = await putDocument(payload.databaseName, nextDoc);
  if (putResponse.rev) {
    nextDoc._rev = putResponse.rev;
  }

  return nextDoc;
};

/** Convert width token to filesystem/attachment-safe deterministic name segment. */
const toFontStretchToken = (stretch: string) => {
  const normalized = normalizeWidthValue(stretch) ?? "100%";
  return normalized.replace(/%/g, "p").replace(/\./g, "_");
};

/** Build deterministic attachment file name for one face variant. */
const buildFontAttachmentName = (
  familySlug: string,
  face: ParsedBunnyFontFace,
): string => {
  const widthToken = toFontStretchToken(face.stretch);
  const subsetToken = normalizeSlug(face.subset ?? "subset") ?? "subset";
  return `${familySlug}-${face.weight}-${face.style}-${widthToken}-${subsetToken}.woff2`;
};

/** Download Bunny-hosted font binary into memory buffer. */
const downloadRemoteFontBuffer = async (remoteUrl: string): Promise<Buffer> => {
  const response = await fetch(remoteUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch font file: ${remoteUrl}`);
  }
  return Buffer.from(await response.arrayBuffer());
};

/** Identify URLs already pointing to local attachment asset route. */
const isKnownFontAttachmentUrl = (url: string): boolean => {
  const normalized = url.trim();
  return normalized.startsWith(FONT_ASSET_API_PREFIX) && normalized.endsWith(".woff2");
};

/** Detect benign delete errors when attachment is already absent. */
const isMissingAttachmentDeleteError = (error: unknown): boolean => {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";
  const normalized = message.toLowerCase();
  return normalized.includes("document is missing attachment") || normalized.includes("not_found");
};

/**
 * Synchronize selected face binaries into the attachment document.
 *
 * @remarks
 * - uploads/overwrites active face binaries under deterministic names,
 * - rewrites face URLs to local attachment route,
 * - removes stale attachments not present in current active profile.
 */
const syncFontAssetAttachments = async (payload: {
  databaseName: string;
  assetsDocument: ContentFontAssetsDocument;
  facesByFamilySlug: Record<string, ParsedBunnyFontFace[]>;
  updatedBy?: string | null;
}): Promise<void> => {
  const existingAttachmentNames = Object.keys(payload.assetsDocument._attachments ?? {});
  const fallbackAttachmentNames = Array.isArray(payload.assetsDocument.activeAttachmentNames)
    ? payload.assetsDocument.activeAttachmentNames
    : [];
  const existingAttachments = new Set<string>([
    ...existingAttachmentNames,
    ...fallbackAttachmentNames,
  ]);
  const activeAttachments = new Set<string>();
  let currentRev = payload.assetsDocument._rev;

  if (!currentRev) {
    throw new Error("Font assets document revision is missing.");
  }

  for (const [familySlug, faces] of Object.entries(payload.facesByFamilySlug)) {
    for (const face of faces) {
      if (isKnownFontAttachmentUrl(face.remoteUrl)) {
        const attachmentName = face.remoteUrl.slice(FONT_ASSET_API_PREFIX.length);
        if (attachmentName) {
          activeAttachments.add(attachmentName);
        }
        continue;
      }

      const attachmentName = buildFontAttachmentName(familySlug, face);
      activeAttachments.add(attachmentName);

      const buffer = await downloadRemoteFontBuffer(face.remoteUrl);
      const putResponse = await putAttachment(
        payload.databaseName,
        CONTENT_FONT_ASSETS_DOC_ID,
        attachmentName,
        buffer,
        FONT_ASSET_CONTENT_TYPE,
        currentRev,
      );
      if (putResponse.rev) {
        currentRev = putResponse.rev;
      }
      if (!existingAttachments.has(attachmentName)) {
        existingAttachments.add(attachmentName);
      }

      face.remoteUrl = `${FONT_ASSET_API_PREFIX}${attachmentName}`;
    }
  }

  for (const attachmentName of Array.from(existingAttachments.values())) {
    if (activeAttachments.has(attachmentName)) {
      continue;
    }

    try {
      const deleteResponse = await deleteAttachment(
        payload.databaseName,
        CONTENT_FONT_ASSETS_DOC_ID,
        attachmentName,
        currentRev,
      );
      if (deleteResponse.rev) {
        currentRev = deleteResponse.rev;
      }
    } catch (error) {
      if (!isMissingAttachmentDeleteError(error)) {
        throw error;
      }
    }
    existingAttachments.delete(attachmentName);
  }

  const nextDoc: ContentFontAssetsDocument = {
    ...(await (async () => {
      const latest = await getDocumentWithAttachments<ContentFontAssetsDocument>(
        payload.databaseName,
        CONTENT_FONT_ASSETS_DOC_ID,
        false,
      );
      if (!latest || typeof latest._rev !== "string" || !latest._rev.trim()) {
        throw new Error("Unable to reload font assets document after attachment sync.");
      }
      return latest;
    })()),
    _id: CONTENT_FONT_ASSETS_DOC_ID,
    type: "content-font-assets",
    activeAttachmentNames: Array.from(activeAttachments.values()).sort(),
    updatedAt: nowIso(),
    updatedBy: payload.updatedBy ?? null,
  } as ContentFontAssetsDocument;
  const putResponse = await putDocument(payload.databaseName, nextDoc);
  if (putResponse.rev) {
    nextDoc._rev = putResponse.rev;
  }
};

/** Render deterministic runtime CSS (`@font-face` + `:root` variables) from resolved faces. */
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
      chunks.push("  font-display: fallback;");
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

/** Normalize unknown thrown value into user-facing error string. */
const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error && typeof error.message === "string" && error.message.trim()) {
    return error.message.trim();
  }
  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }
  return "Unknown error";
};

/**
 * Apply selected font profile end-to-end.
 *
 * @remarks
 * This is the expensive operation:
 * - validates selected families,
 * - ensures attachment doc exists,
 * - fetches remote faces,
 * - syncs binaries into CouchDB attachments,
 * - renders/persists runtime CSS and status metadata.
 */
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
  const familiesToMaterialize = Array.from(
    new Set([settings.sansFamily, settings.displayFamily]),
  );
  const familyLabels = Object.fromEntries(
    familiesToMaterialize.map((entry) => [entry, toFontFamilyLabel(entry)]),
  );
  const databaseName = getContentDatabaseName();

  try {
    const assetsDocument = await ensureFontAssetsDocument({
      databaseName,
      updatedBy: payload.updatedBy,
    });

    const facesByFamilySlug: Record<string, ParsedBunnyFontFace[]> = {};
    for (const familySlug of familiesToMaterialize) {
      facesByFamilySlug[familySlug] = await resolveRemoteFamilyFaces(
        familySlug,
        settings.styles,
        settings.weights,
        settings.widths,
      );
    }

    await syncFontAssetAttachments({
      databaseName,
      assetsDocument,
      facesByFamilySlug,
      updatedBy: payload.updatedBy,
    });

    const facesByLabel: Record<string, ParsedBunnyFontFace[]> = {};
    for (const familySlug of familiesToMaterialize) {
      const label = familyLabels[familySlug] ?? toFontFamilyLabel(familySlug);
      facesByLabel[label] = facesByFamilySlug[familySlug] ?? [];
    }

    const runtimeCss = renderRuntimeCss({
      sansLabel: familyLabels[settings.sansFamily] ?? toFontFamilyLabel(settings.sansFamily),
      displayLabel: familyLabels[settings.displayFamily] ?? toFontFamilyLabel(settings.displayFamily),
      facesByFamily: facesByLabel,
    });

    const nextDoc: ContentFontSettingsDocument = {
      ...nextStatusBase,
      status: "applied",
      lastApplyError: null,
      lastAppliedAt: nowIso(),
      lastAppliedBy: payload.updatedBy ?? null,
      runtimeCssVersion: Date.now(),
      runtimeCssPath: RUNTIME_CSS_PUBLIC_PATH,
      runtimeCssText: runtimeCss,
      runtimeAssetMode: "attachment",
    };
    const persistedDoc = await persistContentFontSettingsDocument(nextDoc);

    return {
      runtimeConfig,
      settings: persistedDoc,
    };
  } catch (error: unknown) {
    const failedDoc: ContentFontSettingsDocument = {
      ...nextStatusBase,
      status: "failed",
      lastApplyError: toErrorMessage(error),
    };
    const persistedFailedDoc = await persistContentFontSettingsDocument(failedDoc);

    throw createError({
      statusCode: 500,
      statusMessage: persistedFailedDoc.lastApplyError ?? "Failed to apply fonts.",
    });
  }
};

/**
 * Return runtime CSS served by `/api/content/fonts/runtime.css`.
 *
 * @remarks
 * Primary source is persisted `runtimeCssText`; if missing, returns variable-only fallback.
 */
export const getRuntimeFontCss = async (): Promise<string> => {
  const { settings } = await getContentFontSettings();
  if (settings.runtimeCssText && settings.runtimeCssText.trim().length > 0) {
    return settings.runtimeCssText;
  }

  return [
    "/* Fallback runtime font variables */",
    ":root {",
    `  --font-sans: '${toFontFamilyLabel(settings.sansFamily)}', sans-serif;`,
    `  --font-display: '${toFontFamilyLabel(settings.displayFamily)}', serif;`,
    "}",
    "",
  ].join("\n");
};

/**
 * Resolve currently active face asset URL for preload/redirect endpoints.
 *
 * @remarks
 * Uses runtime CSS as the canonical applied snapshot and returns attachment-backed URLs only.
 * Falls back to nearest available weight/stretch if exact profile is unavailable.
 */
export const resolveActiveRuntimeFontAsset = async (payload: {
  role: "sans" | "display";
  weight: number;
  style?: ContentFontStyle;
  stretch?: ContentFontWidth;
}): Promise<{ publicUrl: string; runtimeCssVersion: number }> => {
  const { settings } = await getContentFontSettings();
  const runtimeCss = await getRuntimeFontCss();
  const runtimeVariables = parseRuntimeFontVariables(runtimeCss);
  const faces = parseRuntimeFontFaces(runtimeCss);
  const fallbackFamilySlug =
    payload.role === "sans" ? settings.sansFamily : settings.displayFamily;
  const familyCandidates = [
    payload.role === "sans" ? runtimeVariables.sansLabel : runtimeVariables.displayLabel,
    toFontFamilyLabel(fallbackFamilySlug),
    ...Array.from(new Set(faces.map((face) => face.family))),
  ].filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);

  const resolveFaceForFamily = (family: string): ParsedRuntimeFontFace | null => {
    const exactFace = findRuntimeFontFace(faces, {
      family,
      style: payload.style ?? "normal",
      weight: payload.weight,
      stretch: payload.stretch,
    });
    if (exactFace) {
      return exactFace;
    }

    const normalizedFamily = family.trim().toLowerCase();
    const style = payload.style ?? "normal";
    const stretch = normalizeWidthValue(payload.stretch) ?? "100%";
    const familyStyleFaces = faces.filter(
      (entry) =>
        entry.family.trim().toLowerCase() === normalizedFamily && entry.style === style,
    );
    if (familyStyleFaces.length === 0) {
      return null;
    }

    const weightCandidates = Array.from(
      new Set(familyStyleFaces.map((entry) => entry.weight)),
    ).sort(
      (left, right) => Math.abs(left - payload.weight) - Math.abs(right - payload.weight) || left - right,
    );
    const closestWeight = weightCandidates[0];
    if (typeof closestWeight !== "number") {
      return null;
    }

    const closestFaces = familyStyleFaces.filter((entry) => entry.weight === closestWeight);
    const exactStretch = closestFaces.find((entry) => entry.stretch === stretch);
    if (exactStretch) {
      return exactStretch;
    }

    const defaultStretch = closestFaces.find((entry) => entry.stretch === "100%");
    if (defaultStretch) {
      return defaultStretch;
    }

    return [...closestFaces].sort((left, right) => compareWidths(left.stretch, right.stretch))[0] ?? null;
  };

  let resolvedFace: ParsedRuntimeFontFace | null = null;
  for (const family of familyCandidates) {
    resolvedFace = resolveFaceForFamily(family);
    if (resolvedFace) {
      break;
    }
  }

  if (!resolvedFace) {
    throw createError({
      statusCode: 404,
      statusMessage: `No active font face found for ${payload.role}-${payload.weight}-${payload.style ?? "normal"}.`,
    });
  }

  const resolvedUrl = resolvedFace.publicUrl.trim();
  const isManagedAttachment = resolvedUrl.startsWith(FONT_ASSET_API_PREFIX);

  if (!isManagedAttachment) {
    throw createError({
      statusCode: 500,
      statusMessage: "Resolved active font asset path must be attachment-backed.",
    });
  }

  return {
    publicUrl: resolvedUrl,
    runtimeCssVersion: settings.runtimeCssVersion,
  };
};
