/**
 * Thin CouchDB access for the analytics engine, built on the database layer's
 * authenticated `couchDBRequest`.
 */
import { couchDBRequest } from "#database/utils/couchdb";

export const couchBaseUrl = (): string =>
  (process.env.COUCHDB_URL || "http://localhost:5984").replace(/\/+$/, "");

export class CouchError extends Error {
  constructor(
    public status: number,
    public error: string,
    reason: string,
  ) {
    super(`CouchDB ${status} ${error}: ${reason}`);
  }
}

/** Performs a request against `<couch>/<path>` and parses JSON. */
export const couch = async <T = any>(
  path: string,
  init: RequestInit = {},
  { allow404 = false }: { allow404?: boolean } = {},
): Promise<T | null> => {
  const response = await couchDBRequest(`${couchBaseUrl()}/${path.replace(/^\/+/, "")}`, init);
  if (response.status === 404 && allow404) return null;
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new CouchError(response.status, body?.error ?? "error", body?.reason ?? response.statusText);
  }
  return body as T;
};

const ensured = new Set<string>();

/** Security object restricting a database to CouchDB admins (no public access). */
const ADMIN_ONLY_SECURITY = {
  admins: { names: [], roles: ["_admin"] },
  members: { names: [], roles: ["_admin"] },
};

/** Creates a database (idempotent) and locks it to CouchDB admins. */
export const ensureDatabase = async (name: string): Promise<void> => {
  if (ensured.has(name)) return;
  const response = await couchDBRequest(`${couchBaseUrl()}/${name}`, { method: "PUT" });
  if (response.status === 201 || response.status === 202) {
    await couch(`${name}/_security`, { method: "PUT", body: JSON.stringify(ADMIN_ONLY_SECURITY) });
  } else if (response.status !== 412) {
    const body = await response.json().catch(() => ({}));
    throw new CouchError(response.status, body?.error ?? "error", body?.reason ?? "create failed");
  }
  ensured.add(name);
};

/** Deletes a database; missing databases are ignored. */
export const dropDatabase = async (name: string): Promise<void> => {
  await couch(`${name}`, { method: "DELETE" }, { allow404: true });
  ensured.delete(name);
};

/** Lists all database names starting with `prefix`. */
export const listDatabases = async (prefix: string): Promise<string[]> => {
  const query = new URLSearchParams({
    startkey: JSON.stringify(prefix),
    endkey: JSON.stringify(`${prefix}￰`),
  });
  return (await couch<string[]>(`_all_dbs?${query}`)) ?? [];
};

export const getDoc = async <T = any>(db: string, id: string): Promise<T | null> =>
  couch<T>(`${db}/${encodeURIComponent(id)}`, {}, { allow404: true });

export const putDoc = async (db: string, doc: Record<string, any>) =>
  couch<{ ok: boolean; id: string; rev: string }>(`${db}/${encodeURIComponent(doc._id)}`, {
    method: "PUT",
    body: JSON.stringify(doc),
  });

export const deleteDoc = async (db: string, id: string, rev: string) =>
  couch(`${db}/${encodeURIComponent(id)}?rev=${encodeURIComponent(rev)}`, { method: "DELETE" });

export const bulk = async (db: string, docs: Record<string, any>[]) =>
  couch<Array<{ id: string; rev?: string; error?: string; reason?: string }>>(`${db}/_bulk_docs`, {
    method: "POST",
    body: JSON.stringify({ docs }),
  });

/**
 * Upserts a document, retrying on conflict. `mutate` receives the current doc
 * (or null) and returns the next version, or null to skip writing.
 */
export const upsertDoc = async <T extends Record<string, any>>(
  db: string,
  id: string,
  mutate: (current: T | null) => T | null,
  attempts = 4,
): Promise<T | null> => {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const current = await getDoc<T>(db, id);
    const next = mutate(current);
    if (!next) return current;
    try {
      const result = await putDoc(db, { ...next, _id: id, ...(current?._rev ? { _rev: current._rev } : {}) });
      return { ...next, _id: id, _rev: result?.rev } as T;
    } catch (error) {
      if (error instanceof CouchError && error.status === 409) continue;
      throw error;
    }
  }
  throw new Error(`upsertDoc: too many conflicts for ${db}/${id}`);
};

/**
 * Streams `_all_docs` rows (with docs) for an id range, in pages.
 * `endkey` is inclusive.
 */
export async function* scanRange<T = any>(
  db: string,
  startkey: string,
  endkey: string,
  pageSize = 2000,
): AsyncGenerator<T[]> {
  let cursor: string | null = startkey;
  let skip = 0;
  while (cursor !== null) {
    const result: any = await couch(
      `${db}/_all_docs`,
      {
        method: "POST",
        body: JSON.stringify({
          startkey: cursor,
          endkey,
          include_docs: true,
          limit: pageSize + 1,
          skip,
        }),
      },
      { allow404: true },
    );
    if (!result) return;
    const rows: any[] = result.rows ?? [];
    const page = rows.slice(0, pageSize).map((row) => row.doc).filter(Boolean);
    if (page.length) yield page as T[];
    if (rows.length > pageSize) {
      cursor = rows[pageSize].id;
      skip = 0;
    } else {
      cursor = null;
    }
  }
}

/** Collects every doc in an id range. */
export const collectRange = async <T = any>(db: string, startkey: string, endkey: string): Promise<T[]> => {
  const docs: T[] = [];
  for await (const page of scanRange<T>(db, startkey, endkey)) docs.push(...page);
  return docs;
};

/** Test seam. */
export const resetEnsuredDatabases = (): void => ensured.clear();
