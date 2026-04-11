import { createError } from "h3";
import { bulkDocs, getView } from "#database/utils/couchdb";
import { contentIdFromPath } from "#content/utils/page-documents";
import { buildLocalizedPath, type ContentI18nConfig } from "#content/utils/i18n";
import { getContentDatabaseName } from "./database";
import {
  ensureDocumentLocalizationMeta,
  getLocaleDocumentId,
  mergeUpdatedAtByLocale,
  readContentDocumentLocalizationMeta,
  toPageDocumentRecord,
} from "./content-i18n";

type MigrationStrategy = "strict" | "fallback-copy";

interface MigrationGroup {
  basePath: string;
  masterId: string;
  docsByLocale: Map<string, Record<string, any>>;
  docsById: Map<string, Record<string, any>>;
  masterDocument: Record<string, any> | null;
  updatedAtByLocale: Record<string, string>;
}

const cloneDoc = (value: Record<string, any>): Record<string, any> =>
  JSON.parse(JSON.stringify(value));

const chunkArray = <T>(input: T[], size: number): T[][] => {
  const output: T[][] = [];
  for (let i = 0; i < input.length; i += size) {
    output.push(input.slice(i, i + size));
  }
  return output;
};

const nowIso = (): string => new Date().toISOString();

const collectMigrationGroups = async (
  i18nConfig: ContentI18nConfig,
): Promise<Map<string, MigrationGroup>> => {
  const databaseName = getContentDatabaseName();
  const viewResult = await getView(databaseName, "content", "by_path", {
    include_docs: true,
  });

  const rows = Array.isArray(viewResult?.rows) ? viewResult.rows : [];
  const groups = new Map<string, MigrationGroup>();

  for (const row of rows) {
    const document = toPageDocumentRecord(row.doc);
    if (!document) {
      continue;
    }

    const meta = readContentDocumentLocalizationMeta(document, i18nConfig);
    const basePath = meta.basePath;
    const locale = meta.locale;
    const masterId = meta.masterId || contentIdFromPath(basePath);
    const updatedAt =
      meta.updatedAtByLocale[locale] ??
      document.updatedAt ??
      document.updated_at ??
      "";

    if (!groups.has(basePath)) {
      groups.set(basePath, {
        basePath,
        masterId,
        docsByLocale: new Map<string, Record<string, any>>(),
        docsById: new Map<string, Record<string, any>>(),
        masterDocument: null,
        updatedAtByLocale: {},
      });
    }

    const group = groups.get(basePath)!;
    group.masterId = masterId;
    group.docsById.set(document._id, document);

    const existingLocaleDoc = group.docsByLocale.get(locale);
    const existingUpdatedAt =
      existingLocaleDoc?.updatedAt ?? existingLocaleDoc?.updated_at ?? "";
    if (!existingLocaleDoc || updatedAt >= existingUpdatedAt) {
      group.docsByLocale.set(locale, document);
    }

    group.updatedAtByLocale = mergeUpdatedAtByLocale(
      group.updatedAtByLocale,
      meta.updatedAtByLocale,
    );
    if (updatedAt) {
      group.updatedAtByLocale[locale] = updatedAt;
    }

    if (document._id === masterId) {
      const currentMasterUpdatedAt =
        group.masterDocument?.updatedAt ?? group.masterDocument?.updated_at ?? "";
      if (!group.masterDocument || updatedAt >= currentMasterUpdatedAt) {
        group.masterDocument = document;
      }
    }
  }

  return groups;
};

export const migrateContentDefaultLocale = async (payload: {
  currentConfig: ContentI18nConfig;
  nextDefaultLocale: string;
  strategy: MigrationStrategy;
}): Promise<{
  migratedPageCount: number;
  missingPageCount: number;
  missingBasePaths: string[];
}> => {
  const { currentConfig, nextDefaultLocale, strategy } = payload;

  if (!currentConfig.locales.includes(nextDefaultLocale)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Target default locale is not enabled.",
    });
  }

  if (nextDefaultLocale === currentConfig.defaultLocale) {
    return {
      migratedPageCount: 0,
      missingPageCount: 0,
      missingBasePaths: [],
    };
  }

  const groups = await collectMigrationGroups(currentConfig);
  const oldDefaultLocale = currentConfig.defaultLocale;
  const databaseName = getContentDatabaseName();
  const timestamp = nowIso();
  const missingBasePaths: string[] = [];

  const nextConfig: ContentI18nConfig = {
    ...currentConfig,
    defaultLocale: nextDefaultLocale,
    prefixedLocales: currentConfig.locales.filter(
      (locale) => locale !== nextDefaultLocale,
    ),
  };

  const docsToWrite: Record<string, any>[] = [];
  const docsToDelete: Record<string, any>[] = [];

  for (const [basePath, group] of groups.entries()) {
    const oldDefaultDoc =
      group.docsByLocale.get(oldDefaultLocale) ?? group.masterDocument;
    if (!oldDefaultDoc) {
      continue;
    }

    const nextDefaultDoc = group.docsByLocale.get(nextDefaultLocale) ?? null;
    if (!nextDefaultDoc && strategy === "strict") {
      missingBasePaths.push(basePath);
      continue;
    }

    const masterId = group.masterId || contentIdFromPath(basePath);
    const oldDefaultTargetId = getLocaleDocumentId(
      basePath,
      oldDefaultLocale,
      { defaultLocale: nextDefaultLocale },
    );

    const masterSource = nextDefaultDoc ?? oldDefaultDoc;
    const masterDoc = cloneDoc(masterSource);
    masterDoc._id = masterId;
    masterDoc._rev = group.masterDocument?._rev;
    masterDoc.path = buildLocalizedPath(basePath, nextDefaultLocale, nextConfig);
    masterDoc.updatedAt = timestamp;
    masterDoc.type = "page";

    const mergedUpdatedAt = mergeUpdatedAtByLocale(group.updatedAtByLocale);
    mergedUpdatedAt[nextDefaultLocale] = timestamp;
    mergedUpdatedAt[oldDefaultLocale] = timestamp;

    const masterMeta = readContentDocumentLocalizationMeta(masterSource, currentConfig);
    ensureDocumentLocalizationMeta(masterDoc, {
      locale: nextDefaultLocale,
      masterId,
      basePath,
      defaultLocale: nextDefaultLocale,
      touchedAt: timestamp,
      fixedBodyPaths: masterMeta.fixedBodyPaths,
      mergedUpdatedAtByLocale: mergedUpdatedAt,
    });

    const oldDefaultLocaleExisting = group.docsById.get(oldDefaultTargetId);
    const oldDefaultLocaleDoc = cloneDoc(oldDefaultDoc);
    oldDefaultLocaleDoc._id = oldDefaultTargetId;
    oldDefaultLocaleDoc._rev = oldDefaultLocaleExisting?._rev;
    oldDefaultLocaleDoc.path = buildLocalizedPath(
      basePath,
      oldDefaultLocale,
      nextConfig,
    );
    oldDefaultLocaleDoc.updatedAt = timestamp;
    oldDefaultLocaleDoc.type = "page";

    const oldMeta = readContentDocumentLocalizationMeta(oldDefaultDoc, currentConfig);
    ensureDocumentLocalizationMeta(oldDefaultLocaleDoc, {
      locale: oldDefaultLocale,
      masterId,
      basePath,
      defaultLocale: nextDefaultLocale,
      touchedAt: timestamp,
      fixedBodyPaths: oldMeta.fixedBodyPaths,
      mergedUpdatedAtByLocale: mergedUpdatedAt,
    });

    docsToWrite.push(masterDoc, oldDefaultLocaleDoc);

    if (nextDefaultDoc && nextDefaultDoc._id !== masterId && nextDefaultDoc._rev) {
      docsToDelete.push({
        _id: nextDefaultDoc._id,
        _rev: nextDefaultDoc._rev,
        _deleted: true,
      });
    }
  }

  if (missingBasePaths.length && strategy === "strict") {
    throw createError({
      statusCode: 409,
      statusMessage: `Cannot migrate default locale. ${missingBasePaths.length} pages are missing "${nextDefaultLocale}".`,
      data: {
        missingBasePaths,
      },
    });
  }

  const payloadDocs = [...docsToWrite, ...docsToDelete];
  for (const chunk of chunkArray(payloadDocs, 200)) {
    const response = await bulkDocs(databaseName, chunk);
    const failed = response.filter((entry) => !entry.ok);
    if (failed.length > 0) {
      const first = failed[0];
      throw createError({
        statusCode: 409,
        statusMessage:
          first.reason ||
          first.error ||
          "Failed while migrating content locale documents.",
      });
    }
  }

  return {
    migratedPageCount: docsToWrite.length > 0 ? docsToWrite.length / 2 : 0,
    missingPageCount: missingBasePaths.length,
    missingBasePaths,
  };
};
