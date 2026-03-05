import { normalizePagePath } from "#content/utils/page";

export const CONTENT_NODE_I18N_KEY = "__contentI18n";
export const CONTENT_META_I18N_KEY = "contentI18n";

export type I18nPathSegment = string | number;

export interface ContentI18nConfig {
  enabled: boolean;
  defaultLocale: string;
  locales: string[];
  prefixedLocales: string[];
}

export interface ContentLocalePathResolution {
  locale: string;
  basePath: string;
  localizedPath: string;
  hasLocalePrefix: boolean;
}

export interface ContentNodeLocaleState {
  props?: Record<string, unknown>;
  updatedAt?: string | null;
}

export interface ContentNodeI18nState {
  locales?: Record<string, ContentNodeLocaleState>;
}

export interface ContentDocumentI18nMeta {
  updatedAtByLocale: Record<string, string>;
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const normalizeLocaleCode = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().replace(/_/g, "-").toLowerCase();
  return normalized.length ? normalized : null;
};

export const nowIso = (): string => new Date().toISOString();

export const cloneI18nValue = <T>(value: T): T => {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof structuredClone === "function") {
    try {
      return structuredClone(value);
    } catch {
      // JSON fallback below
    }
  }

  try {
    return JSON.parse(JSON.stringify(value)) as T;
  } catch {
    return value;
  }
};

export const resolveContentI18nConfig = (input: unknown): ContentI18nConfig => {
  const source = isPlainObject(input) ? input : {};
  const localesInput = Array.isArray(source.locales) ? source.locales : [];

  const defaultLocale =
    normalizeLocaleCode(source.defaultLocale) ?? "en";

  const locales = Array.from(
    new Set(
      localesInput
        .map((entry) => normalizeLocaleCode(entry))
        .filter((entry): entry is string => Boolean(entry)),
    ),
  );

  if (!locales.includes(defaultLocale)) {
    locales.unshift(defaultLocale);
  }

  const prefixedLocales = locales.filter((locale) => locale !== defaultLocale);

  return {
    enabled: locales.length > 0,
    defaultLocale,
    locales,
    prefixedLocales,
  };
};

export const buildLocalizedPath = (
  basePath: string,
  locale: string,
  config: ContentI18nConfig,
): string => {
  const normalizedBasePath = normalizePagePath(basePath);
  const normalizedLocale = normalizeLocaleCode(locale) ?? config.defaultLocale;

  if (normalizedLocale === config.defaultLocale) {
    return normalizedBasePath;
  }

  if (normalizedBasePath === "/") {
    return `/${normalizedLocale}`;
  }

  return `/${normalizedLocale}${normalizedBasePath}`;
};

export const resolveContentLocalePath = (
  path: string,
  config: ContentI18nConfig,
): ContentLocalePathResolution => {
  const normalizedPath = normalizePagePath(path);

  if (!config.enabled || config.prefixedLocales.length === 0) {
    return {
      locale: config.defaultLocale,
      basePath: normalizedPath,
      localizedPath: normalizedPath,
      hasLocalePrefix: false,
    };
  }

  const segments = normalizedPath.split("/").filter(Boolean);
  const firstSegment = normalizeLocaleCode(segments[0]);
  const prefixedLocales = new Set(config.prefixedLocales);

  if (firstSegment && prefixedLocales.has(firstSegment)) {
    const baseSegments = segments.slice(1);
    const basePath = baseSegments.length ? `/${baseSegments.join("/")}` : "/";
    return {
      locale: firstSegment,
      basePath,
      localizedPath: normalizedPath,
      hasLocalePrefix: true,
    };
  }

  return {
    locale: config.defaultLocale,
    basePath: normalizedPath,
    localizedPath: normalizedPath,
    hasLocalePrefix: false,
  };
};

export const parseNodeI18nState = (value: unknown): ContentNodeI18nState => {
  if (!value) {
    return {};
  }

  const parsed =
    typeof value === "string"
      ? (() => {
          try {
            return JSON.parse(value) as unknown;
          } catch {
            return null;
          }
        })()
      : value;

  if (!isPlainObject(parsed)) {
    return {};
  }

  const locales = isPlainObject(parsed.locales) ? parsed.locales : {};
  const normalizedLocales: Record<string, ContentNodeLocaleState> = {};

  for (const [localeKey, localeState] of Object.entries(locales)) {
    const locale = normalizeLocaleCode(localeKey);
    if (!locale || !isPlainObject(localeState)) {
      continue;
    }
    normalizedLocales[locale] = {
      props: isPlainObject(localeState.props)
        ? cloneI18nValue(localeState.props)
        : {},
      updatedAt:
        typeof localeState.updatedAt === "string"
          ? localeState.updatedAt
          : null,
    };
  }

  return { locales: normalizedLocales };
};

export const serializeNodeI18nState = (
  value: ContentNodeI18nState,
): string => JSON.stringify(value);

const pathSegmentValue = (
  input: unknown,
  segment: I18nPathSegment,
): unknown => {
  if (typeof segment === "number") {
    if (!Array.isArray(input)) {
      return undefined;
    }
    return input[segment];
  }

  if (!isPlainObject(input)) {
    return undefined;
  }

  return input[segment];
};

export const getValueAtPath = (
  input: unknown,
  path: I18nPathSegment[],
): unknown => {
  let current: unknown = input;
  for (const segment of path) {
    current = pathSegmentValue(current, segment);
    if (typeof current === "undefined") {
      return undefined;
    }
  }
  return current;
};

const setValueAtPathRecursive = (
  input: unknown,
  path: I18nPathSegment[],
  value: unknown,
  index: number,
): unknown => {
  if (index >= path.length) {
    return cloneI18nValue(value);
  }

  const segment = path[index];
  const nextExisting = pathSegmentValue(input, segment);
  const nextValue = setValueAtPathRecursive(
    nextExisting,
    path,
    value,
    index + 1,
  );

  if (typeof segment === "number") {
    const output = Array.isArray(input)
      ? [...input]
      : [];
    output[segment] = nextValue;
    return output;
  }

  const output = isPlainObject(input)
    ? { ...input }
    : {};
  output[segment] = nextValue;
  return output;
};

export const setValueAtPath = (
  input: unknown,
  path: I18nPathSegment[],
  value: unknown,
): unknown => {
  if (!path.length) {
    return cloneI18nValue(value);
  }
  return setValueAtPathRecursive(input, path, value, 0);
};

export const mergeLocalizedValue = (
  baseValue: unknown,
  localePatch: unknown,
): unknown => {
  if (typeof localePatch === "undefined") {
    return cloneI18nValue(baseValue);
  }

  if (
    localePatch === null ||
    typeof localePatch !== "object"
  ) {
    return cloneI18nValue(localePatch);
  }

  if (Array.isArray(localePatch)) {
    const result = Array.isArray(baseValue)
      ? cloneI18nValue(baseValue)
      : [];

    localePatch.forEach((patchEntry, index) => {
      if (typeof patchEntry === "undefined") {
        return;
      }
      const baseEntry = Array.isArray(baseValue)
        ? baseValue[index]
        : undefined;
      result[index] = mergeLocalizedValue(baseEntry, patchEntry);
    });

    return result;
  }

  const result = isPlainObject(baseValue)
    ? cloneI18nValue(baseValue)
    : {};

  for (const [key, patchEntry] of Object.entries(localePatch)) {
    const baseEntry = isPlainObject(baseValue)
      ? baseValue[key]
      : undefined;
    result[key] = mergeLocalizedValue(baseEntry, patchEntry);
  }

  return result;
};

export const getLocaleRootPatch = (
  state: ContentNodeI18nState,
  locale: string,
  rootPropKey: string,
): unknown => {
  const normalizedLocale = normalizeLocaleCode(locale);
  if (!normalizedLocale) {
    return undefined;
  }

  const localeState = state.locales?.[normalizedLocale];
  if (!localeState || !isPlainObject(localeState.props)) {
    return undefined;
  }

  return localeState.props[rootPropKey];
};

export const hasLocalePathValue = (
  state: ContentNodeI18nState,
  locale: string,
  rootPropKey: string,
  path: I18nPathSegment[],
): boolean => {
  const rootPatch = getLocaleRootPatch(state, locale, rootPropKey);
  if (typeof rootPatch === "undefined") {
    return false;
  }

  if (!path.length) {
    return true;
  }

  return typeof getValueAtPath(rootPatch, path) !== "undefined";
};

export const isLocalizedValueMissing = (value: unknown): boolean => {
  if (value === null || value === undefined) {
    return true;
  }
  if (typeof value === "string") {
    return value.trim().length === 0;
  }
  return false;
};

export const setLocalePathValue = (
  state: ContentNodeI18nState,
  locale: string,
  rootPropKey: string,
  path: I18nPathSegment[],
  value: unknown,
  updatedAt: string = nowIso(),
): ContentNodeI18nState => {
  const normalizedLocale = normalizeLocaleCode(locale);
  if (!normalizedLocale) {
    return cloneI18nValue(state);
  }

  const next = cloneI18nValue(state);
  if (!isPlainObject(next.locales)) {
    next.locales = {};
  }

  if (!isPlainObject(next.locales[normalizedLocale])) {
    next.locales[normalizedLocale] = {};
  }

  const localeState = next.locales[
    normalizedLocale
  ] as ContentNodeLocaleState;

  if (!isPlainObject(localeState.props)) {
    localeState.props = {};
  }

  const existingRoot = localeState.props[rootPropKey];
  localeState.props[rootPropKey] = setValueAtPath(existingRoot, path, value);
  localeState.updatedAt = updatedAt;

  return next;
};

export const getDocumentI18nMeta = (meta: unknown): ContentDocumentI18nMeta => {
  if (!isPlainObject(meta)) {
    return { updatedAtByLocale: {} };
  }

  const raw = meta[CONTENT_META_I18N_KEY];
  if (!isPlainObject(raw)) {
    return { updatedAtByLocale: {} };
  }

  const updatedAtByLocale = isPlainObject(raw.updatedAtByLocale)
    ? raw.updatedAtByLocale
    : {};

  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(updatedAtByLocale)) {
    const locale = normalizeLocaleCode(key);
    if (!locale || typeof value !== "string" || !value.trim()) {
      continue;
    }
    normalized[locale] = value;
  }

  return { updatedAtByLocale: normalized };
};

export const ensureDocumentLocaleInitialized = (
  meta: Record<string, any>,
  locale: string,
  timestamp: string = nowIso(),
) => {
  const normalizedLocale = normalizeLocaleCode(locale);
  if (!normalizedLocale) {
    return;
  }

  const current = getDocumentI18nMeta(meta);
  if (current.updatedAtByLocale[normalizedLocale]) {
    return;
  }

  meta[CONTENT_META_I18N_KEY] = {
    ...(isPlainObject(meta[CONTENT_META_I18N_KEY])
      ? meta[CONTENT_META_I18N_KEY]
      : {}),
    updatedAtByLocale: {
      ...current.updatedAtByLocale,
      [normalizedLocale]: timestamp,
    },
  };
};

export const markDocumentLocaleUpdatedAt = (
  meta: Record<string, any>,
  locale: string,
  timestamp: string = nowIso(),
) => {
  const normalizedLocale = normalizeLocaleCode(locale);
  if (!normalizedLocale) {
    return;
  }

  const current = getDocumentI18nMeta(meta);

  meta[CONTENT_META_I18N_KEY] = {
    ...(isPlainObject(meta[CONTENT_META_I18N_KEY])
      ? meta[CONTENT_META_I18N_KEY]
      : {}),
    updatedAtByLocale: {
      ...current.updatedAtByLocale,
      [normalizedLocale]: timestamp,
    },
  };
};
