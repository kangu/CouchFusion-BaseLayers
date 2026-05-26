import { createError } from "h3";
import { getDocument, putDocument } from "#database/utils/couchdb";
import {
  CONTENT_COMPONENT_PICKER_CATEGORIES_DOC_ID,
  CONTENT_COMPONENT_PICKER_CATEGORIES_TYPE,
  normalizeComponentPickerCategorySettings,
  slugifyComponentPickerCategory,
  type ComponentPickerCategorySettings,
} from "#content/app/utils/component-picker-categories";
import { getContentDatabaseName } from "./database";

export type ContentComponentPickerCategoriesDocument =
  ComponentPickerCategorySettings & {
    _id: typeof CONTENT_COMPONENT_PICKER_CATEGORIES_DOC_ID;
    type: typeof CONTENT_COMPONENT_PICKER_CATEGORIES_TYPE;
    updatedAt: string;
    updatedBy: string | null;
  };

const nowIso = (): string => new Date().toISOString();

export const emptyComponentPickerCategoriesDocument =
  (): ContentComponentPickerCategoriesDocument => ({
    _id: CONTENT_COMPONENT_PICKER_CATEGORIES_DOC_ID,
    type: CONTENT_COMPONENT_PICKER_CATEGORIES_TYPE,
    categories: [],
    assignments: {},
    updatedAt: nowIso(),
    updatedBy: null,
  });

const assertUniqueRawCategoryIds = (value: unknown) => {
  const categories =
    value && typeof value === "object" && Array.isArray((value as any).categories)
      ? ((value as any).categories as unknown[])
      : [];
  const seen = new Set<string>();
  for (const category of categories) {
    if (!category || typeof category !== "object") {
      continue;
    }
    const raw = category as Record<string, unknown>;
    const id = slugifyComponentPickerCategory(raw.id || raw.label);
    if (!id) {
      continue;
    }
    if (seen.has(id)) {
      throw createError({
        statusCode: 400,
        statusMessage: `Duplicate component picker category id: ${id}`,
      });
    }
    seen.add(id);
  }
};

const toDocument = (
  value: unknown,
): ContentComponentPickerCategoriesDocument | null => {
  if (!value || typeof value !== "object") {
    return null;
  }
  const raw = value as Record<string, any>;
  if (raw._id !== CONTENT_COMPONENT_PICKER_CATEGORIES_DOC_ID) {
    return null;
  }
  const normalized = normalizeComponentPickerCategorySettings(raw);
  return {
    ...normalized,
    _id: CONTENT_COMPONENT_PICKER_CATEGORIES_DOC_ID,
    type: CONTENT_COMPONENT_PICKER_CATEGORIES_TYPE,
    updatedAt:
      typeof raw.updatedAt === "string" && raw.updatedAt
        ? raw.updatedAt
        : nowIso(),
    updatedBy: typeof raw.updatedBy === "string" ? raw.updatedBy : null,
  };
};

export const getComponentPickerCategoriesSettings =
  async (): Promise<ContentComponentPickerCategoriesDocument | null> => {
    const databaseName = getContentDatabaseName();
    const doc = await getDocument(
      databaseName,
      CONTENT_COMPONENT_PICKER_CATEGORIES_DOC_ID,
    );
    return toDocument(doc);
  };

export const getEffectiveComponentPickerCategoriesSettings =
  async (): Promise<ContentComponentPickerCategoriesDocument> =>
    (await getComponentPickerCategoriesSettings()) ??
    emptyComponentPickerCategoriesDocument();

export const saveComponentPickerCategoriesSettings = async (payload: {
  settings: unknown;
  updatedBy?: string | null;
}): Promise<ContentComponentPickerCategoriesDocument> => {
  assertUniqueRawCategoryIds(payload.settings);

  const databaseName = getContentDatabaseName();
  const existing = await getDocument(
    databaseName,
    CONTENT_COMPONENT_PICKER_CATEGORIES_DOC_ID,
  );
  const existingRev =
    existing && typeof existing === "object" && typeof existing._rev === "string"
      ? existing._rev
      : undefined;
  const incoming =
    payload.settings && typeof payload.settings === "object"
      ? (payload.settings as Record<string, any>)
      : {};
  const incomingRev = typeof incoming._rev === "string" ? incoming._rev : undefined;

  if (existingRev && incomingRev !== existingRev) {
    throw createError({
      statusCode: 409,
      statusMessage:
        "Component picker category settings changed. Reload before saving.",
    });
  }

  const normalized = normalizeComponentPickerCategorySettings(payload.settings);
  const nextDoc: ContentComponentPickerCategoriesDocument = {
    ...normalized,
    _id: CONTENT_COMPONENT_PICKER_CATEGORIES_DOC_ID,
    _rev: existingRev,
    type: CONTENT_COMPONENT_PICKER_CATEGORIES_TYPE,
    updatedAt: nowIso(),
    updatedBy: payload.updatedBy ?? null,
  };

  const response = await putDocument(databaseName, nextDoc);
  if (response.rev) {
    nextDoc._rev = response.rev;
  }
  return nextDoc;
};
