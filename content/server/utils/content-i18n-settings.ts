import { createError } from "h3";
import { getDocument, putDocument } from "#database/utils/couchdb";
import {
  normalizeLocaleCode,
  resolveContentI18nConfig,
  type ContentI18nConfig,
} from "#content/utils/i18n";
import { getContentDatabaseName } from "./database";

export const CONTENT_I18N_SETTINGS_DOC_ID = "content-settings:i18n";

export interface ContentI18nSettingsDocument {
  _id: string;
  _rev?: string;
  type: "content-i18n-settings";
  defaultLocale: string;
  locales: string[];
  updatedAt: string;
  updatedBy?: string | null;
}

const nowIso = (): string => new Date().toISOString();

const normalizeLocaleList = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map((entry) => normalizeLocaleCode(entry))
        .filter((entry): entry is string => Boolean(entry)),
    ),
  );
};

const toSettingsDoc = (
  value: unknown,
): ContentI18nSettingsDocument | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Record<string, any>;
  if (candidate._id !== CONTENT_I18N_SETTINGS_DOC_ID) {
    return null;
  }

  const defaultLocale = normalizeLocaleCode(candidate.defaultLocale);
  const locales = normalizeLocaleList(candidate.locales);

  if (!defaultLocale || !locales.length) {
    return null;
  }

  if (!locales.includes(defaultLocale)) {
    locales.unshift(defaultLocale);
  }

  return {
    _id: CONTENT_I18N_SETTINGS_DOC_ID,
    _rev: typeof candidate._rev === "string" ? candidate._rev : undefined,
    type: "content-i18n-settings",
    defaultLocale,
    locales,
    updatedAt:
      typeof candidate.updatedAt === "string" ? candidate.updatedAt : nowIso(),
    updatedBy:
      typeof candidate.updatedBy === "string" ? candidate.updatedBy : null,
  };
};

const runtimeI18nConfig = (): ContentI18nConfig => {
  const runtimeConfig = useRuntimeConfig();
  return resolveContentI18nConfig(
    runtimeConfig.content?.i18n ?? runtimeConfig.public?.content?.i18n,
  );
};

const applyOverrideToConfig = (
  base: ContentI18nConfig,
  override: ContentI18nSettingsDocument | null,
): ContentI18nConfig => {
  if (!override) {
    return base;
  }

  return resolveContentI18nConfig({
    defaultLocale: override.defaultLocale,
    locales: override.locales,
  });
};

export const getContentI18nSettingsOverride = async (): Promise<ContentI18nSettingsDocument | null> => {
  const databaseName = getContentDatabaseName();
  const doc = await getDocument(databaseName, CONTENT_I18N_SETTINGS_DOC_ID);
  return toSettingsDoc(doc);
};

export const getEffectiveContentI18nConfig = async (): Promise<{
  runtime: ContentI18nConfig;
  override: ContentI18nSettingsDocument | null;
  effective: ContentI18nConfig;
}> => {
  const runtime = runtimeI18nConfig();
  const override = await getContentI18nSettingsOverride();
  const effective = applyOverrideToConfig(runtime, override);

  return {
    runtime,
    override,
    effective,
  };
};

export const saveContentI18nSettingsOverride = async (payload: {
  defaultLocale: string;
  locales: string[];
  updatedBy?: string | null;
}): Promise<ContentI18nSettingsDocument> => {
  const runtime = runtimeI18nConfig();
  const locales = normalizeLocaleList(payload.locales);
  const normalizedDefault =
    normalizeLocaleCode(payload.defaultLocale) ?? runtime.defaultLocale;

  if (!locales.length) {
    throw createError({
      statusCode: 400,
      statusMessage: "At least one locale is required.",
    });
  }

  if (!locales.includes(normalizedDefault)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Default locale must be included in enabled locales.",
    });
  }

  const databaseName = getContentDatabaseName();
  const existing = await getDocument(databaseName, CONTENT_I18N_SETTINGS_DOC_ID);

  const nextDoc: ContentI18nSettingsDocument = {
    _id: CONTENT_I18N_SETTINGS_DOC_ID,
    _rev:
      existing && typeof existing === "object" && typeof existing._rev === "string"
        ? existing._rev
        : undefined,
    type: "content-i18n-settings",
    defaultLocale: normalizedDefault,
    locales,
    updatedAt: nowIso(),
    updatedBy: payload.updatedBy ?? null,
  };

  const response = await putDocument(databaseName, nextDoc);
  if (response.rev) {
    nextDoc._rev = response.rev;
  }

  return nextDoc;
};
