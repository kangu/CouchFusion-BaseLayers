import { normalizePagePath } from "../../content/utils/page";
import {
  contentIdFromPath,
  deriveStem,
} from "../../content/utils/page-documents";
import type { StoredContentPageDocument } from "../../content/server/utils/content-documents";
import type { CouchTestHarness } from "../utils/couchdb";

export type MinimalContentBody = Array<any>;

export interface ContentPageSeedOptions {
  path: string;
  title?: string | null;
  layout?: Record<string, any> | null;
  body?: MinimalContentBody;
  seoTitle?: string | null;
  seoDescription?: string | null;
  meta?: Record<string, any> | null;
  navigation?: boolean;
  extension?: string;
  createdAt?: string;
  updatedAt?: string;
  type?: string;
  includeHistorySnapshot?: boolean;
  historyTimestamp?: string;
}

const clone = <T>(value: T): T => {
  if (value === null || value === undefined) {
    return value;
  }

  try {
    return structuredClone(value);
  } catch {}

  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return value;
  }
};

const defaultLayout = { spacing: "none" };

export const buildContentPageDocument = (
  options: ContentPageSeedOptions,
): StoredContentPageDocument => {
  const normalizedPath = normalizePagePath(options.path);
  const id = contentIdFromPath(normalizedPath);
  const createdAt = options.createdAt ?? new Date().toISOString();
  const updatedAt = options.updatedAt ?? createdAt;

  return {
    _id: id,
    title: options.title ?? `Page ${normalizedPath}`,
    layout: options.layout ? clone(options.layout) : clone(defaultLayout),
    body: {
      type: "minimal",
      value: clone(options.body ?? []),
    },
    path: normalizedPath,
    seo: {
      title: options.seoTitle ?? options.title ?? `Page ${normalizedPath}`,
      description: options.seoDescription ?? "Seeded page description.",
    },
    stem: deriveStem(normalizedPath),
    meta: clone(options.meta ?? {}),
    extension: options.extension ?? "md",
    navigation: options.navigation ?? true,
    createdAt,
    updatedAt,
    type: options.type ?? "page",
  };
};

export const buildPageHistoryDocument = (
  document: StoredContentPageDocument,
  timestamp?: string,
) => {
  const savedAt = timestamp ?? new Date().toISOString();
  const base = clone(document);
  delete (base as any)._rev;

  return {
    ...base,
    _id: `oldpage-${document._id}-${savedAt}`,
    savedAt,
    originalId: document._id,
    type: "page-history",
    updatedAt: savedAt,
  };
};

export const seedContentPages = async (
  harness: CouchTestHarness,
  pages: ContentPageSeedOptions | ContentPageSeedOptions[],
) => {
  const entries = Array.isArray(pages) ? pages : [pages];

  const documents = entries.flatMap((entry) => {
    const pageDoc = buildContentPageDocument(entry);
    const collection: any[] = [pageDoc];

    if (entry.includeHistorySnapshot) {
      collection.push(
        buildPageHistoryDocument(pageDoc, entry.historyTimestamp),
      );
    }

    return collection;
  });

  await harness.seedDocuments(documents);

  return documents;
};
