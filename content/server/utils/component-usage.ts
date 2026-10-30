import { getAllDocs } from "#database/utils/couchdb";
import { getContentDatabaseName } from "./database";

/**
 * A page document that references a component.
 */
export interface ComponentPageUsage {
  id: string;
  path: string;
  title: string | null;
}

/**
 * Result of scanning page documents for a component.
 */
export interface ComponentPageUsageScan {
  pages: ComponentPageUsage[];
  /** Number of page documents inspected (master and locale documents). */
  scanned: number;
}

export interface ComponentUsageMatchOptions {
  /**
   * When true, a bare text node equal to a name also counts as a match.
   * Kept only for the historical global-alias behaviour; component usage leaves it off.
   */
  matchTextNodes?: boolean;
}

type PageDocument = Record<string, any>;
type PageDocumentLoader = () => Promise<PageDocument[]>;

/**
 * Page documents are `page-<path>` (default locale) and `page-<path>::<locale>`
 * (locale variants). Both are full documents with their own `body.value`, so one
 * walk over the `page-` key range covers every locale. `oldpage-` history is skipped.
 */
export const isUsagePageDocument = (doc: PageDocument): boolean => {
  const id = typeof doc._id === "string" ? doc._id : "";
  return id.startsWith("page-") && !id.startsWith("oldpage-");
};

/**
 * Walk one minimark entry (`[tag, props?, ...children]`) and report whether any
 * component tag in it matches one of `names`.
 */
export const entryContainsComponentTag = (
  entry: unknown,
  names: ReadonlySet<string>,
  options: ComponentUsageMatchOptions = {},
): boolean => {
  if (typeof entry === "string") {
    return options.matchTextNodes === true && names.has(entry);
  }
  if (!Array.isArray(entry)) {
    return false;
  }

  const [rawComponent, maybeProps] = entry;
  if (typeof rawComponent === "string" && names.has(rawComponent)) {
    return true;
  }

  const childStartIndex =
    maybeProps && typeof maybeProps === "object" && !Array.isArray(maybeProps)
      ? 2
      : 1;

  for (const child of entry.slice(childStartIndex)) {
    if (entryContainsComponentTag(child, names, options)) {
      return true;
    }
  }

  return false;
};

/**
 * Report whether a page document's minimark body references one of `names`.
 */
export const documentContainsComponentTag = (
  doc: PageDocument,
  names: ReadonlySet<string>,
  options: ComponentUsageMatchOptions = {},
): boolean => {
  const bodyValue = doc.body?.value;
  if (!Array.isArray(bodyValue)) {
    return false;
  }
  return bodyValue.some((entry) => entryContainsComponentTag(entry, names, options));
};

/**
 * Tag names a content component can appear under in page bodies: the registry
 * id (kebab-case, e.g. `network-hero`) and its PascalCase alias (`NetworkHero`).
 */
export const componentTagNames = (componentId: string): string[] => {
  const kebab = componentId.trim();
  if (!kebab) {
    return [];
  }
  const pascal = kebab
    .split("-")
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join("");
  return Array.from(new Set([kebab, pascal].filter(Boolean)));
};

/** Valid registry component ids: kebab-case, starting with a letter. */
export const COMPONENT_ID_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

const loadPageDocuments: PageDocumentLoader = async () => {
  const response = await getAllDocs(getContentDatabaseName(), {
    startkey: "page-",
    endkey: "page-￰",
    include_docs: true,
  });
  const rows = Array.isArray(response?.rows) ? response.rows : [];
  return rows
    .map((row: any) => row?.doc as PageDocument | undefined)
    .filter((doc): doc is PageDocument => Boolean(doc));
};

/**
 * Scan all page documents for any of the given tag names.
 *
 * @param names Tag names to look for.
 * @param options Matching options.
 * @param loader Injectable page loader (tests); defaults to the content database.
 */
export const scanPageComponentUsage = async (
  names: readonly string[],
  options: ComponentUsageMatchOptions = {},
  loader: PageDocumentLoader = loadPageDocuments,
): Promise<ComponentPageUsageScan> => {
  const nameSet = new Set(names.filter(Boolean));
  if (nameSet.size === 0) {
    return { pages: [], scanned: 0 };
  }

  const docs = await loader();
  const pages: ComponentPageUsage[] = [];
  let scanned = 0;

  for (const doc of docs) {
    if (!isUsagePageDocument(doc)) {
      continue;
    }
    scanned += 1;
    if (!documentContainsComponentTag(doc, nameSet, options)) {
      continue;
    }
    pages.push({
      id: typeof doc._id === "string" ? doc._id : "",
      path: typeof doc.path === "string" && doc.path ? doc.path : "/",
      title: typeof doc.title === "string" ? doc.title : null,
    });
  }

  pages.sort((left, right) =>
    left.path.localeCompare(right.path) || left.id.localeCompare(right.id),
  );
  return { pages, scanned };
};

/**
 * Find page documents (all locales) that reference a content component by its
 * registry id or PascalCase alias. Invalid ids return an empty result.
 *
 * @param componentId Kebab-case registry id, e.g. `network-hero`.
 * @param loader Injectable page loader (tests).
 */
export const findComponentPageUsage = async (
  componentId: string,
  loader?: PageDocumentLoader,
): Promise<ComponentPageUsageScan> => {
  const id = componentId.trim();
  if (!COMPONENT_ID_PATTERN.test(id)) {
    return { pages: [], scanned: 0 };
  }
  return scanPageComponentUsage(componentTagNames(id), {}, loader);
};
