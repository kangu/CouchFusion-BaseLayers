import { createError } from "h3";
import { getDocument, putDocument, type CouchDBDocument } from "#database/utils/couchdb";
import { getContentDatabaseName } from "./database";
import { resolveContentFontRuntimeSlug } from "./content-fonts";

/**
 * Canonical content-layer document id for runtime theme settings.
 *
 * @remarks
 * Stored in the `--content` database to keep runtime styling independent from host-app
 * `site-config` documents and consistent with the font settings architecture.
 */
export const CONTENT_THEME_SETTINGS_DOC_ID = "content-settings:theme";

const CONTENT_THEME_DOCUMENT_TYPE = "content-tailwind-settings";

/** One editable/read-only token exposed by the theme API schema. */
export interface ContentThemeTokenDefinition {
  key: string;
  label: string;
  namespace: string;
  valueType: "color" | "length" | "number" | "string";
  simpleEditable: boolean;
  runtimeWritable: boolean;
  owner: "theme" | "fonts";
  description: string;
}

/** Namespace metadata used by the full editor to group token definitions. */
export interface ContentThemeNamespaceDefinition {
  key: string;
  label: string;
  compileTimeOnly: boolean;
  description: string;
}

/** Full schema payload returned to admin clients. */
export interface ContentThemeSchema {
  namespaces: ContentThemeNamespaceDefinition[];
  tokens: ContentThemeTokenDefinition[];
  simpleTokenKeys: string[];
  fullEditableTokenKeys: string[];
  readOnlyTokenKeys: string[];
}

/**
 * Canonical settings document persisted in CouchDB.
 *
 * @remarks
 * Two-step save/apply model:
 * - `draftTokens` is edited by save operations.
 * - `appliedTokens` is only updated by apply operations and feeds runtime CSS.
 */
export interface ContentThemeSettingsDocument extends CouchDBDocument {
  _id: typeof CONTENT_THEME_SETTINGS_DOC_ID;
  type: typeof CONTENT_THEME_DOCUMENT_TYPE;
  draftTokens: Record<string, string>;
  appliedTokens: Record<string, string>;
  runtimeCssVersion: number;
  status: "idle" | "applied" | "failed";
  lastApplyError: string | null;
  lastAppliedAt: string | null;
  lastAppliedBy: string | null;
  updatedAt: string;
  updatedBy: string | null;
}

interface ContentThemeAppProfile {
  presetTokens: Record<string, string>;
  simpleTokenKeys?: string[];
  tokenLabelOverrides?: Record<string, string>;
}

const nowIso = (): string => new Date().toISOString();

/**
 * Namespace catalog shown in full mode.
 *
 * @remarks
 * Includes all Tailwind theme namespaces even when the current project has no concrete
 * keys in a namespace yet. This keeps the UI discoverable while still relying on an
 * allowlisted key set for actual persistence.
 */
const CONTENT_THEME_NAMESPACES: ContentThemeNamespaceDefinition[] = [
  {
    key: "color",
    label: "Colors",
    compileTimeOnly: false,
    description:
      "Tailwind color tokens (`--color-*`) and app semantic color variables.",
  },
  {
    key: "font",
    label: "Fonts",
    compileTimeOnly: false,
    description:
      "Font-family tokens (`--font-*`). In this project they are owned by the font pipeline.",
  },
  {
    key: "text",
    label: "Typography Sizes",
    compileTimeOnly: false,
    description: "Tailwind text-size tokens (`--text-*`).",
  },
  {
    key: "font-weight",
    label: "Font Weights",
    compileTimeOnly: false,
    description: "Tailwind font-weight tokens (`--font-weight-*`).",
  },
  {
    key: "tracking",
    label: "Letter Spacing",
    compileTimeOnly: false,
    description: "Tailwind tracking tokens (`--tracking-*`).",
  },
  {
    key: "leading",
    label: "Line Height",
    compileTimeOnly: false,
    description: "Tailwind line-height tokens (`--leading-*`).",
  },
  {
    key: "spacing",
    label: "Spacing",
    compileTimeOnly: false,
    description: "Tailwind spacing tokens (`--spacing-*`).",
  },
  {
    key: "radius",
    label: "Border Radius",
    compileTimeOnly: false,
    description: "Tailwind radius tokens (`--radius-*`) and app radius aliases.",
  },
  {
    key: "shadow",
    label: "Shadows",
    compileTimeOnly: false,
    description: "Tailwind shadow tokens (`--shadow-*`).",
  },
  {
    key: "inset-shadow",
    label: "Inset Shadows",
    compileTimeOnly: false,
    description: "Tailwind inset-shadow tokens (`--inset-shadow-*`).",
  },
  {
    key: "drop-shadow",
    label: "Drop Shadows",
    compileTimeOnly: false,
    description: "Tailwind drop-shadow tokens (`--drop-shadow-*`).",
  },
  {
    key: "blur",
    label: "Blur",
    compileTimeOnly: false,
    description: "Tailwind blur tokens (`--blur-*`).",
  },
  {
    key: "perspective",
    label: "Perspective",
    compileTimeOnly: false,
    description: "Tailwind perspective tokens (`--perspective-*`).",
  },
  {
    key: "aspect",
    label: "Aspect Ratios",
    compileTimeOnly: false,
    description: "Tailwind aspect-ratio tokens (`--aspect-*`).",
  },
  {
    key: "ease",
    label: "Easing",
    compileTimeOnly: false,
    description: "Tailwind easing tokens (`--ease-*`).",
  },
  {
    key: "animate",
    label: "Animations",
    compileTimeOnly: false,
    description: "Tailwind animation tokens (`--animate-*`).",
  },
  {
    key: "breakpoint",
    label: "Breakpoints",
    compileTimeOnly: true,
    description:
      "Responsive variant tokens (`--breakpoint-*`); compile-time only in this runtime system.",
  },
  {
    key: "container",
    label: "Container Queries",
    compileTimeOnly: true,
    description:
      "Container variant tokens (`--container-*`); compile-time only in this runtime system.",
  },
];

/**
 * Allowlisted token definitions.
 *
 * @remarks
 * This is the only set of keys accepted by write APIs. Entries can be read-only
 * (`runtimeWritable = false`) to support discoverability without allowing writes.
 */
const CONTENT_THEME_TOKEN_DEFINITIONS: ContentThemeTokenDefinition[] = [
  {
    key: "--color-orange-custom",
    label: "Orange Custom",
    namespace: "color",
    valueType: "color",
    simpleEditable: true,
    runtimeWritable: true,
    owner: "theme",
    description: "Primary brand orange token used by custom utility classes.",
  },
  {
    key: "--color-orange-custom-hover",
    label: "Orange Custom Hover",
    namespace: "color",
    valueType: "color",
    simpleEditable: true,
    runtimeWritable: true,
    owner: "theme",
    description: "Hover state for the primary brand orange.",
  },
  {
    key: "--color-primary",
    label: "Primary",
    namespace: "color",
    valueType: "color",
    simpleEditable: true,
    runtimeWritable: true,
    owner: "theme",
    description: "Tailwind primary color token.",
  },
  {
    key: "--color-secondary",
    label: "Secondary",
    namespace: "color",
    valueType: "color",
    simpleEditable: true,
    runtimeWritable: true,
    owner: "theme",
    description: "Tailwind secondary color token.",
  },
  {
    key: "--breakpoint-xs",
    label: "Breakpoint XS",
    namespace: "breakpoint",
    valueType: "length",
    simpleEditable: false,
    runtimeWritable: false,
    owner: "theme",
    description: "Compile-time responsive breakpoint token.",
  },
  {
    key: "--font-sans",
    label: "Sans Font",
    namespace: "font",
    valueType: "string",
    simpleEditable: false,
    runtimeWritable: false,
    owner: "fonts",
    description: "Read-only. Managed by content font settings/apply workflow.",
  },
  {
    key: "--font-display",
    label: "Display Font",
    namespace: "font",
    valueType: "string",
    simpleEditable: false,
    runtimeWritable: false,
    owner: "fonts",
    description: "Read-only. Managed by content font settings/apply workflow.",
  },
  {
    key: "--border",
    label: "Border",
    namespace: "color",
    valueType: "string",
    simpleEditable: false,
    runtimeWritable: true,
    owner: "theme",
    description: "Semantic border token.",
  },
  {
    key: "--input",
    label: "Input",
    namespace: "color",
    valueType: "string",
    simpleEditable: false,
    runtimeWritable: true,
    owner: "theme",
    description: "Semantic input token.",
  },
  {
    key: "--ring",
    label: "Ring",
    namespace: "color",
    valueType: "string",
    simpleEditable: false,
    runtimeWritable: true,
    owner: "theme",
    description: "Semantic focus-ring token.",
  },
  {
    key: "--background",
    label: "Background",
    namespace: "color",
    valueType: "string",
    simpleEditable: true,
    runtimeWritable: true,
    owner: "theme",
    description: "Base background token.",
  },
  {
    key: "--foreground",
    label: "Foreground",
    namespace: "color",
    valueType: "string",
    simpleEditable: true,
    runtimeWritable: true,
    owner: "theme",
    description: "Base foreground token.",
  },
  {
    key: "--primary",
    label: "Primary (Semantic)",
    namespace: "color",
    valueType: "string",
    simpleEditable: false,
    runtimeWritable: true,
    owner: "theme",
    description: "Semantic primary token used by app UI components.",
  },
  {
    key: "--primary-foreground",
    label: "Primary Foreground",
    namespace: "color",
    valueType: "string",
    simpleEditable: false,
    runtimeWritable: true,
    owner: "theme",
    description: "Semantic foreground for primary surfaces.",
  },
  {
    key: "--secondary",
    label: "Secondary (Semantic)",
    namespace: "color",
    valueType: "color",
    simpleEditable: false,
    runtimeWritable: true,
    owner: "theme",
    description: "Semantic secondary token used by app UI components.",
  },
  {
    key: "--secondary-foreground",
    label: "Secondary Foreground",
    namespace: "color",
    valueType: "string",
    simpleEditable: false,
    runtimeWritable: true,
    owner: "theme",
    description: "Semantic foreground for secondary surfaces.",
  },
  {
    key: "--destructive",
    label: "Destructive",
    namespace: "color",
    valueType: "string",
    simpleEditable: false,
    runtimeWritable: true,
    owner: "theme",
    description: "Semantic destructive color token.",
  },
  {
    key: "--destructive-foreground",
    label: "Destructive Foreground",
    namespace: "color",
    valueType: "string",
    simpleEditable: false,
    runtimeWritable: true,
    owner: "theme",
    description: "Semantic foreground for destructive surfaces.",
  },
  {
    key: "--muted",
    label: "Muted",
    namespace: "color",
    valueType: "string",
    simpleEditable: false,
    runtimeWritable: true,
    owner: "theme",
    description: "Semantic muted background token.",
  },
  {
    key: "--muted-foreground",
    label: "Muted Foreground",
    namespace: "color",
    valueType: "string",
    simpleEditable: false,
    runtimeWritable: true,
    owner: "theme",
    description: "Semantic foreground for muted surfaces.",
  },
  {
    key: "--accent",
    label: "Accent",
    namespace: "color",
    valueType: "string",
    simpleEditable: false,
    runtimeWritable: true,
    owner: "theme",
    description: "Semantic accent token.",
  },
  {
    key: "--accent-foreground",
    label: "Accent Foreground",
    namespace: "color",
    valueType: "string",
    simpleEditable: false,
    runtimeWritable: true,
    owner: "theme",
    description: "Semantic foreground for accent surfaces.",
  },
  {
    key: "--popover",
    label: "Popover",
    namespace: "color",
    valueType: "string",
    simpleEditable: false,
    runtimeWritable: true,
    owner: "theme",
    description: "Semantic popover background token.",
  },
  {
    key: "--popover-foreground",
    label: "Popover Foreground",
    namespace: "color",
    valueType: "string",
    simpleEditable: false,
    runtimeWritable: true,
    owner: "theme",
    description: "Semantic foreground for popover surfaces.",
  },
  {
    key: "--card",
    label: "Card",
    namespace: "color",
    valueType: "string",
    simpleEditable: false,
    runtimeWritable: true,
    owner: "theme",
    description: "Semantic card background token.",
  },
  {
    key: "--card-foreground",
    label: "Card Foreground",
    namespace: "color",
    valueType: "string",
    simpleEditable: false,
    runtimeWritable: true,
    owner: "theme",
    description: "Semantic foreground for card surfaces.",
  },
  {
    key: "--radius",
    label: "Radius",
    namespace: "radius",
    valueType: "length",
    simpleEditable: true,
    runtimeWritable: true,
    owner: "theme",
    description: "Base border radius token.",
  },
  {
    key: "--orange",
    label: "Orange Alias",
    namespace: "color",
    valueType: "color",
    simpleEditable: false,
    runtimeWritable: true,
    owner: "theme",
    description: "Legacy orange alias token used in app custom CSS.",
  },
  {
    key: "--orange-hover",
    label: "Orange Hover Alias",
    namespace: "color",
    valueType: "color",
    simpleEditable: false,
    runtimeWritable: true,
    owner: "theme",
    description: "Legacy orange hover alias token used in app custom CSS.",
  },
];

const CONTENT_THEME_TOKEN_DEFINITION_BY_KEY = new Map(
  CONTENT_THEME_TOKEN_DEFINITIONS.map((entry) => [entry.key, entry]),
);

const BITVOCATION_THEME_PRESET: Record<string, string> = {
  "--color-orange-custom": "#f8931a",
  "--color-orange-custom-hover": "#EDAC5B",
  "--color-primary": "#f8931a",
  "--color-secondary": "#7f9bff",
  "--breakpoint-xs": "25rem",
  "--font-sans": "'Montserrat', 'Inter', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
  "--border": "214.3 31.8% 91.4%",
  "--input": "214.3 31.8% 91.4%",
  "--ring": "215 20.2% 65.1%",
  "--background": "0 0% 100%",
  "--foreground": "224 71.4% 4.1%",
  "--primary": "220.9 39.3% 11%",
  "--primary-foreground": "210 20% 98%",
  "--secondary": "#7f9bff",
  "--secondary-foreground": "220.9 39.3% 11%",
  "--destructive": "0 84.2% 60.2%",
  "--destructive-foreground": "210 20% 98%",
  "--muted": "220 14.3% 95.9%",
  "--muted-foreground": "220 8.9% 46.1%",
  "--accent": "220 14.3% 95.9%",
  "--accent-foreground": "220.9 39.3% 11%",
  "--popover": "0 0% 100%",
  "--popover-foreground": "224 71.4% 4.1%",
  "--card": "0 0% 100%",
  "--card-foreground": "224 71.4% 4.1%",
  "--radius": "0.5rem",
  "--orange": "#f8931a",
  "--orange-hover": "rgb(237, 172, 91)",
};

const COUCHFUSION_THEME_PRESET: Record<string, string> = {
  "--color-primary": "#22c55e",
  "--color-secondary": "#f7931a",
  "--background": "38 35% 93%",
  "--foreground": "0 0% 8%",
  "--radius": "1rem",
};

const COUCHFUSION_SIMPLE_TOKEN_KEYS = [
  "--color-primary",
  "--color-secondary",
  "--background",
  "--foreground",
  "--radius",
];

const COUCHFUSION_TOKEN_LABEL_OVERRIDES: Record<string, string> = {
  "--color-primary": "CouchFusion Green",
  "--color-secondary": "Bitcoin Orange",
  "--background": "Paper Background",
  "--foreground": "Ink Foreground",
};

const DEFAULT_THEME_PRESET: Record<string, string> = {};

const DEFAULT_THEME_PROFILE: ContentThemeAppProfile = {
  presetTokens: DEFAULT_THEME_PRESET,
};

const normalizeThemeSlug = (slug: string): string => slug.trim().toLowerCase();

const getContentThemeProfileBySlug = (slug: string): ContentThemeAppProfile => {
  const normalizedSlug = normalizeThemeSlug(slug);

  if (normalizedSlug === "bitvocation") {
    return {
      presetTokens: BITVOCATION_THEME_PRESET,
    };
  }

  if (
    normalizedSlug === "cfcom" ||
    normalizedSlug === "couchfusioncom" ||
    normalizedSlug === "couchfusion-com"
  ) {
    return {
      presetTokens: COUCHFUSION_THEME_PRESET,
      simpleTokenKeys: COUCHFUSION_SIMPLE_TOKEN_KEYS,
      tokenLabelOverrides: COUCHFUSION_TOKEN_LABEL_OVERRIDES,
    };
  }

  return DEFAULT_THEME_PROFILE;
};

/** Resolve app-specific preset defaults from normalized app slug. */
export const getContentThemePresetBySlug = (slug: string): Record<string, string> => {
  return {
    ...getContentThemeProfileBySlug(slug).presetTokens,
  };
};

const resolveContentThemeSlug = (): string => {
  const runtimeConfig = useRuntimeConfig();
  const fallbackCwdName = process.cwd().split("/").filter(Boolean).pop() ?? "app";
  return resolveContentFontRuntimeSlug(runtimeConfig, fallbackCwdName);
};

const resolveContentThemePreset = (): Record<string, string> => {
  return getContentThemePresetBySlug(resolveContentThemeSlug());
};

const normalizeLengthToken = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const lengthPattern =
    /^-?\d+(\.\d+)?(px|rem|em|%|vh|vw|vmin|vmax|svh|lvh|dvh|ch|ex)$/i;
  return lengthPattern.test(trimmed) ? trimmed : null;
};

const normalizeNumberToken = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? String(parsed) : null;
};

/** Normalize one token value according to token definition value type. */
const normalizeTokenValue = (
  definition: ContentThemeTokenDefinition,
  value: unknown,
): string | null => {
  const raw = typeof value === "string" ? value : String(value ?? "");
  const trimmed = raw.trim();

  switch (definition.valueType) {
    case "length":
      return normalizeLengthToken(trimmed);
    case "number":
      return normalizeNumberToken(trimmed);
    case "color":
    case "string":
      return trimmed.length > 0 ? trimmed : null;
    default:
      return null;
  }
};

/** Normalize stored map values but never throw for unknown/invalid legacy keys. */
const normalizeStoredTokenMap = (value: unknown): Record<string, string> => {
  if (!value || typeof value !== "object") {
    return {};
  }

  const source = value as Record<string, unknown>;
  const next: Record<string, string> = {};

  for (const [key, rawValue] of Object.entries(source)) {
    const definition = CONTENT_THEME_TOKEN_DEFINITION_BY_KEY.get(key);
    if (!definition) {
      continue;
    }
    const normalized = normalizeTokenValue(definition, rawValue);
    if (!normalized) {
      continue;
    }
    next[key] = normalized;
  }

  return next;
};

/**
 * Normalize incoming draft payload from admin save requests.
 *
 * @remarks
 * Throws user-facing 400 errors for unknown keys, read-only keys, or invalid values.
 */
export const normalizeContentThemeDraftTokens = (
  value: unknown,
): Record<string, string> => {
  if (!value || typeof value !== "object") {
    throw createError({
      statusCode: 400,
      statusMessage: "Theme draft tokens payload must be an object.",
    });
  }

  const source = value as Record<string, unknown>;
  const next: Record<string, string> = {};

  for (const [key, rawValue] of Object.entries(source)) {
    const definition = CONTENT_THEME_TOKEN_DEFINITION_BY_KEY.get(key);
    if (!definition) {
      throw createError({
        statusCode: 400,
        statusMessage: `Unsupported theme token key: ${key}.`,
      });
    }
    if (!definition.runtimeWritable || definition.owner !== "theme") {
      throw createError({
        statusCode: 400,
        statusMessage: `Theme token is read-only: ${key}.`,
      });
    }

    const normalized = normalizeTokenValue(definition, rawValue);
    if (!normalized) {
      throw createError({
        statusCode: 400,
        statusMessage: `Invalid value for theme token ${key}.`,
      });
    }
    next[key] = normalized;
  }

  return next;
};

const defaultSettingsDocument = (
  presetTokens: Record<string, string>,
): ContentThemeSettingsDocument => ({
  _id: CONTENT_THEME_SETTINGS_DOC_ID,
  type: CONTENT_THEME_DOCUMENT_TYPE,
  draftTokens: {
    ...presetTokens,
  },
  appliedTokens: {
    ...presetTokens,
  },
  runtimeCssVersion: Date.now(),
  status: "idle",
  lastApplyError: null,
  lastAppliedAt: null,
  lastAppliedBy: null,
  updatedAt: nowIso(),
  updatedBy: null,
});

const normalizeSettingsDocument = (
  value: unknown,
  presetTokens: Record<string, string>,
): ContentThemeSettingsDocument => {
  const defaults = defaultSettingsDocument(presetTokens);
  if (!value || typeof value !== "object") {
    return defaults;
  }

  const source = value as Record<string, unknown>;

  const draftTokens = {
    ...presetTokens,
    ...normalizeStoredTokenMap(source.draftTokens),
  };
  const appliedTokens = {
    ...presetTokens,
    ...normalizeStoredTokenMap(source.appliedTokens),
  };

  const statusSource = source.status;
  const status =
    statusSource === "idle" || statusSource === "applied" || statusSource === "failed"
      ? statusSource
      : defaults.status;

  return {
    ...defaults,
    _rev: typeof source._rev === "string" ? source._rev : undefined,
    draftTokens,
    appliedTokens,
    runtimeCssVersion:
      typeof source.runtimeCssVersion === "number" && Number.isFinite(source.runtimeCssVersion)
        ? source.runtimeCssVersion
        : defaults.runtimeCssVersion,
    status,
    lastApplyError:
      typeof source.lastApplyError === "string" && source.lastApplyError.trim().length > 0
        ? source.lastApplyError.trim()
        : null,
    lastAppliedAt:
      typeof source.lastAppliedAt === "string" && source.lastAppliedAt.trim().length > 0
        ? source.lastAppliedAt.trim()
        : null,
    lastAppliedBy:
      typeof source.lastAppliedBy === "string" && source.lastAppliedBy.trim().length > 0
        ? source.lastAppliedBy.trim()
        : null,
    updatedAt:
      typeof source.updatedAt === "string" && source.updatedAt.trim().length > 0
        ? source.updatedAt.trim()
        : defaults.updatedAt,
    updatedBy:
      typeof source.updatedBy === "string" && source.updatedBy.trim().length > 0
        ? source.updatedBy.trim()
        : null,
  };
};

const persistSettingsDocument = async (
  settings: ContentThemeSettingsDocument,
): Promise<ContentThemeSettingsDocument> => {
  const databaseName = getContentDatabaseName();
  const existing = await getDocument<ContentThemeSettingsDocument>(
    databaseName,
    CONTENT_THEME_SETTINGS_DOC_ID,
  );

  const nextDoc: ContentThemeSettingsDocument = {
    ...settings,
    _id: CONTENT_THEME_SETTINGS_DOC_ID,
    type: CONTENT_THEME_DOCUMENT_TYPE,
    _rev: existing?._rev,
  };

  if (!nextDoc._rev) {
    delete nextDoc._rev;
  }

  const response = await putDocument(databaseName, nextDoc);
  if (response.rev) {
    nextDoc._rev = response.rev;
  }

  return nextDoc;
};

const getDefaultSimpleTokenKeys = (): string[] =>
  CONTENT_THEME_TOKEN_DEFINITIONS.filter(
    (entry) => entry.simpleEditable && entry.runtimeWritable && entry.owner === "theme",
  ).map((entry) => entry.key);

const getThemeTokenDefinitionsForProfile = (
  profile: ContentThemeAppProfile,
): ContentThemeTokenDefinition[] =>
  CONTENT_THEME_TOKEN_DEFINITIONS.map((entry) => {
    const label = profile.tokenLabelOverrides?.[entry.key];
    return label
      ? {
          ...entry,
          label,
        }
      : { ...entry };
  });

/** Return immutable schema contract used by admin editors. */
export const getContentThemeSchema = (slug?: string): ContentThemeSchema => {
  const profile = slug
    ? getContentThemeProfileBySlug(slug)
    : getContentThemeProfileBySlug(resolveContentThemeSlug());

  const simpleTokenKeys = profile.simpleTokenKeys
    ? [...profile.simpleTokenKeys]
    : getDefaultSimpleTokenKeys();

  const fullEditableTokenKeys = CONTENT_THEME_TOKEN_DEFINITIONS.filter(
    (entry) => entry.runtimeWritable && entry.owner === "theme",
  ).map((entry) => entry.key);

  const readOnlyTokenKeys = CONTENT_THEME_TOKEN_DEFINITIONS.filter(
    (entry) => !entry.runtimeWritable || entry.owner !== "theme",
  ).map((entry) => entry.key);

  return {
    namespaces: [...CONTENT_THEME_NAMESPACES],
    tokens: getThemeTokenDefinitionsForProfile(profile),
    simpleTokenKeys,
    fullEditableTokenKeys,
    readOnlyTokenKeys,
  };
};

/** Read effective theme settings (with app preset fallback normalization). */
export const getContentThemeSettings = async (): Promise<{
  schema: ContentThemeSchema;
  settings: ContentThemeSettingsDocument;
}> => {
  const preset = resolveContentThemePreset();
  const databaseName = getContentDatabaseName();
  const existing = await getDocument<ContentThemeSettingsDocument>(
    databaseName,
    CONTENT_THEME_SETTINGS_DOC_ID,
  );
  const settings = normalizeSettingsDocument(existing, preset);
  const schema = getContentThemeSchema();

  return {
    schema,
    settings,
  };
};

/** Save draft token edits without publishing to runtime CSS. */
export const saveContentThemeSettings = async (payload: {
  draftTokens: unknown;
  updatedBy?: string | null;
}): Promise<{ schema: ContentThemeSchema; settings: ContentThemeSettingsDocument }> => {
  const { schema, settings } = await getContentThemeSettings();
  const normalizedDraftEdits = normalizeContentThemeDraftTokens(payload.draftTokens);

  const nextDoc: ContentThemeSettingsDocument = {
    ...settings,
    draftTokens: {
      ...settings.draftTokens,
      ...normalizedDraftEdits,
    },
    updatedAt: nowIso(),
    updatedBy: payload.updatedBy ?? null,
  };

  const persisted = await persistSettingsDocument(nextDoc);
  return {
    schema,
    settings: persisted,
  };
};

/** Publish current draft tokens as active runtime theme values. */
export const applyContentThemeSettings = async (payload: {
  updatedBy?: string | null;
}): Promise<{ schema: ContentThemeSchema; settings: ContentThemeSettingsDocument }> => {
  const { schema, settings } = await getContentThemeSettings();

  try {
    const nextDoc: ContentThemeSettingsDocument = {
      ...settings,
      appliedTokens: {
        ...settings.appliedTokens,
        ...settings.draftTokens,
      },
      runtimeCssVersion: Date.now(),
      status: "applied",
      lastApplyError: null,
      lastAppliedAt: nowIso(),
      lastAppliedBy: payload.updatedBy ?? null,
      updatedAt: nowIso(),
      updatedBy: payload.updatedBy ?? null,
    };
    const persisted = await persistSettingsDocument(nextDoc);

    return {
      schema,
      settings: persisted,
    };
  } catch (error) {
    const failedDoc: ContentThemeSettingsDocument = {
      ...settings,
      status: "failed",
      lastApplyError:
        error instanceof Error && error.message.trim().length > 0
          ? error.message.trim()
          : "Failed to apply theme settings.",
      updatedAt: nowIso(),
      updatedBy: payload.updatedBy ?? null,
    };
    const persistedFailed = await persistSettingsDocument(failedDoc);

    throw createError({
      statusCode: 500,
      statusMessage: persistedFailed.lastApplyError ?? "Failed to apply theme settings.",
    });
  }
};

/**
 * Render runtime stylesheet from applied tokens.
 *
 * @remarks
 * Only theme-owned writable keys are emitted, keeping font keys owned by the
 * dedicated font pipeline.
 */
export const renderRuntimeThemeCss = (appliedTokens: Record<string, string>): string => {
  const writableThemeTokens = CONTENT_THEME_TOKEN_DEFINITIONS.filter(
    (definition) => definition.runtimeWritable && definition.owner === "theme",
  ).map((definition) => definition.key);

  const resolvedEntries = writableThemeTokens
    .map((key) => {
      const rawValue = appliedTokens[key];
      const definition = CONTENT_THEME_TOKEN_DEFINITION_BY_KEY.get(key);
      if (!definition || typeof rawValue !== "string") {
        return null;
      }
      const normalized = normalizeTokenValue(definition, rawValue);
      if (!normalized) {
        return null;
      }
      return { key, value: normalized };
    })
    .filter((entry): entry is { key: string; value: string } => Boolean(entry));

  if (resolvedEntries.length === 0) {
    return ["/* Generated by content theme manager */", ""].join("\n");
  }

  const lines: string[] = [
    "/* Generated by content theme manager */",
    ":root {",
  ];

  for (const entry of resolvedEntries) {
    lines.push(`  ${entry.key}: ${entry.value};`);
  }
  lines.push("}");
  lines.push("");

  return lines.join("\n");
};

/** Public runtime stylesheet payload consumed by theme runtime head plugin. */
export const getRuntimeThemeCss = async (): Promise<string> => {
  const { settings } = await getContentThemeSettings();
  return renderRuntimeThemeCss(settings.appliedTokens);
};
