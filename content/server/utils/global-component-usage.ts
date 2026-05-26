import { getAllDocs } from "#database/utils/couchdb";
import { normalizeGlobalComponentId } from "#content/utils/global-components";
import { getContentDatabaseName } from "./database";

export interface GlobalComponentPageUsage {
  id: string;
  path: string;
  title: string | null;
}

const isPageDocument = (doc: Record<string, any>): boolean => {
  const id = typeof doc._id === "string" ? doc._id : "";
  if (!id.startsWith("page-")) {
    return false;
  }
  if (id.startsWith("oldpage-")) {
    return false;
  }
  return true;
};

const entryContainsAlias = (entry: unknown, aliasId: string): boolean => {
  if (typeof entry === "string") {
    return entry === aliasId;
  }
  if (!Array.isArray(entry)) {
    return false;
  }

  const [rawComponent, maybeProps] = entry;
  if (rawComponent === aliasId) {
    return true;
  }

  const childStartIndex =
    maybeProps &&
    typeof maybeProps === "object" &&
    !Array.isArray(maybeProps)
      ? 2
      : 1;

  for (const child of entry.slice(childStartIndex)) {
    if (entryContainsAlias(child, aliasId)) {
      return true;
    }
  }

  return false;
};

const documentContainsAlias = (
  doc: Record<string, any>,
  aliasId: string,
): boolean => {
  const bodyValue = doc.body?.value;
  if (!Array.isArray(bodyValue)) {
    return false;
  }
  return bodyValue.some((entry) => entryContainsAlias(entry, aliasId));
};

export const findGlobalComponentPageUsage = async (
  aliasIdInput: string,
): Promise<GlobalComponentPageUsage[]> => {
  const aliasId = normalizeGlobalComponentId(aliasIdInput);
  if (!aliasId) {
    return [];
  }

  const databaseName = getContentDatabaseName();
  const response = await getAllDocs(databaseName, {
    startkey: "page-",
    endkey: "page-\ufff0",
    include_docs: true,
  });

  const rows = Array.isArray(response?.rows) ? response.rows : [];
  const pages: GlobalComponentPageUsage[] = [];

  for (const row of rows) {
    const doc = row?.doc as Record<string, any> | undefined;
    if (!doc || !isPageDocument(doc)) {
      continue;
    }
    if (!documentContainsAlias(doc, aliasId)) {
      continue;
    }
    pages.push({
      id: typeof doc._id === "string" ? doc._id : "",
      path: typeof doc.path === "string" && doc.path ? doc.path : "/",
      title: typeof doc.title === "string" ? doc.title : null,
    });
  }

  return pages.sort((left, right) => left.path.localeCompare(right.path));
};
