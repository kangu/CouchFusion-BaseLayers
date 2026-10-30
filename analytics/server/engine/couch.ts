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

/** Timeout for single-document reads and writes. */
export const DEFAULT_TIMEOUT_MS = 15_000;
/** Timeout for range scans, bulk writes and database create/delete. */
export const LONG_TIMEOUT_MS = 60_000;

/** Maps a fetch/body-read failure to a CouchError: 504 on timeout, 503 when unreachable. */
const toCouchError = (error: any, timeoutMs: number): CouchError => {
  if (error instanceof CouchError) return error;
  if (error?.name === "TimeoutError" || error?.name === "AbortError") {
    return new CouchError(504, "timeout", `no response within ${timeoutMs} ms`);
  }
  return new CouchError(503, "unreachable", error?.cause?.code ?? error?.message ?? String(error));
};

/** Sends an authenticated request with a deadline that also covers reading the body. */
const send = async (url: string, init: RequestInit, timeoutMs: number): Promise<Response> => {
  try {
    return await couchDBRequest(url, { ...init, signal: init.signal ?? AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    throw toCouchError(error, timeoutMs);
  }
};

/** Performs a request against `<couch>/<path>` and parses JSON. */
export const couch = async <T = any>(
  path: string,
  init: RequestInit = {},
  { allow404 = false, timeoutMs = DEFAULT_TIMEOUT_MS }: { allow404?: boolean; timeoutMs?: number } = {},
): Promise<T | null> => {
  const response = await send(`${couchBaseUrl()}/${path.replace(/^\/+/, "")}`, init, timeoutMs);
  if (response.status === 404 && allow404) {
    await response.body?.cancel().catch(() => undefined);
    return null;
  }
  let body: any;
  try {
    body = await response.json();
  } catch (error) {
    // A cut-off or unreadable success body must not look like an empty result.
    if (response.ok) throw toCouchError(error, timeoutMs);
    body = {};
  }
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
  const response = await send(`${couchBaseUrl()}/${name}`, { method: "PUT" }, LONG_TIMEOUT_MS);
  if (response.status === 201 || response.status === 202) {
    await response.body?.cancel().catch(() => undefined);
    await couch(`${name}/_security`, { method: "PUT", body: JSON.stringify(ADMIN_ONLY_SECURITY) });
  } else if (response.status === 412) {
    await response.body?.cancel().catch(() => undefined);
  } else {
    const body = await response.json().catch(() => ({}));
    throw new CouchError(response.status, body?.error ?? "error", body?.reason ?? "create failed");
  }
  ensured.add(name);
};

/** Forgets that a database exists (e.g. after a 404), so the next write re-creates it. */
export const forgetDatabase = (name: string): void => {
  ensured.delete(name);
};

/** Deletes a database; missing databases are ignored. */
export const dropDatabase = async (name: string): Promise<void> => {
  await couch(`${name}`, { method: "DELETE" }, { allow404: true, timeoutMs: LONG_TIMEOUT_MS });
  ensured.delete(name);
};

/** Lists all database names starting with `prefix`. */
export const listDatabases = async (prefix: string): Promise<string[]> => {
  const query = new URLSearchParams({
    startkey: JSON.stringify(prefix),
    endkey: JSON.stringify(`${prefix}￰`),
  });
  return (await couch<string[]>(`_all_dbs?${query}`, {}, { timeoutMs: LONG_TIMEOUT_MS })) ?? [];
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

export const bulk = async (db: string, docs: Record<string, any>[], timeoutMs = LONG_TIMEOUT_MS) =>
  couch<Array<{ id: string; rev?: string; error?: string; reason?: string }>>(
    `${db}/_bulk_docs`,
    { method: "POST", body: JSON.stringify({ docs }) },
    { timeoutMs },
  );

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
      { allow404: true, timeoutMs: LONG_TIMEOUT_MS },
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

/**
 * Returns up to `limit` ids and revs from the start of an id range, without
 * document bodies. Used to delete in pages.
 */
export const scanIds = async (
  db: string,
  startkey: string,
  endkey: string,
  limit = 1000,
): Promise<Array<{ id: string; rev: string }>> => {
  const result: any = await couch(
    `${db}/_all_docs`,
    { method: "POST", body: JSON.stringify({ startkey, endkey, limit }) },
    { allow404: true, timeoutMs: LONG_TIMEOUT_MS },
  );
  return (result?.rows ?? []).filter((row: any) => row.value?.rev).map((row: any) => ({ id: row.id, rev: row.value.rev }));
};

/** Collects every doc in an id range. */
export const collectRange = async <T = any>(db: string, startkey: string, endkey: string): Promise<T[]> => {
  const docs: T[] = [];
  for await (const page of scanRange<T>(db, startkey, endkey)) docs.push(...page);
  return docs;
};

/** Test seam. */
export const resetEnsuredDatabases = (): void => ensured.clear();
