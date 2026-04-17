import { getDocument, putDocument } from "#database/utils/couchdb";
import { getContentDatabaseName } from "./database";
import {
  CONTENT_GLOBAL_COMPONENTS_DOC_ID,
  normalizeGlobalComponentEntries,
  type ContentGlobalComponentEntry,
} from "#content/utils/global-components";

export interface ContentGlobalComponentsDocument {
  _id: string;
  _rev?: string;
  type: "content-global-components";
  entries: ContentGlobalComponentEntry[];
  updatedAt: string;
  updatedBy?: string | null;
}

const nowIso = (): string => new Date().toISOString();

const toSettingsDoc = (
  value: unknown,
): ContentGlobalComponentsDocument | null => {
  if (!value || typeof value !== "object") {
    return null;
  }
  const candidate = value as Record<string, any>;
  if (candidate._id !== CONTENT_GLOBAL_COMPONENTS_DOC_ID) {
    return null;
  }

  return {
    _id: CONTENT_GLOBAL_COMPONENTS_DOC_ID,
    _rev: typeof candidate._rev === "string" ? candidate._rev : undefined,
    type: "content-global-components",
    entries: normalizeGlobalComponentEntries(candidate.entries),
    updatedAt:
      typeof candidate.updatedAt === "string" ? candidate.updatedAt : nowIso(),
    updatedBy:
      typeof candidate.updatedBy === "string" ? candidate.updatedBy : null,
  };
};

export const getGlobalComponentsSettings = async (): Promise<ContentGlobalComponentsDocument | null> => {
  const databaseName = getContentDatabaseName();
  const doc = await getDocument(databaseName, CONTENT_GLOBAL_COMPONENTS_DOC_ID);
  return toSettingsDoc(doc);
};

export const getEffectiveGlobalComponentEntries = async (): Promise<ContentGlobalComponentEntry[]> => {
  const settings = await getGlobalComponentsSettings();
  return settings?.entries ?? [];
};

export const saveGlobalComponentsSettings = async (payload: {
  entries: unknown;
  updatedBy?: string | null;
}): Promise<ContentGlobalComponentsDocument> => {
  const databaseName = getContentDatabaseName();
  const existing = await getDocument(databaseName, CONTENT_GLOBAL_COMPONENTS_DOC_ID);

  const nextDoc: ContentGlobalComponentsDocument = {
    _id: CONTENT_GLOBAL_COMPONENTS_DOC_ID,
    _rev:
      existing && typeof existing === "object" && typeof existing._rev === "string"
        ? existing._rev
        : undefined,
    type: "content-global-components",
    entries: normalizeGlobalComponentEntries(payload.entries),
    updatedAt: nowIso(),
    updatedBy: payload.updatedBy ?? null,
  };

  const response = await putDocument(databaseName, nextDoc);
  if (response.rev) {
    nextDoc._rev = response.rev;
  }

  return nextDoc;
};
