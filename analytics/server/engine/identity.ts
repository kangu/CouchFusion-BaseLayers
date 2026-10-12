/**
 * Cookieless visitor identity: sha256(dailySalt | site | ip | ua). Salts are
 * random per site-local day, stored as `salt:<yyyymmdd>`, and deleted after two
 * days so hashes can no longer be linked back to an IP/UA pair.
 */
import { createHash, randomBytes } from "node:crypto";
import type { EngineConfig } from "./config";
import { CouchError, collectRange, deleteDoc, getDoc, putDoc } from "./couch";
import { mainDb } from "./storage";
import { addDays } from "./time";

const memo = new Map<string, string>();
const pending = new Map<string, Promise<string>>();

/** Returns the salt for `day`, creating it on first use. */
export const getDailySalt = async (config: EngineConfig, day: string): Promise<string> => {
  const db = mainDb(config);
  const key = `${db}:${day}`;
  const known = memo.get(key);
  if (known) return known;
  const inflight = pending.get(key);
  if (inflight) return inflight;

  const promise = (async () => {
    const id = `salt:${day}`;
    let doc = await getDoc<{ salt: string }>(db, id);
    if (!doc) {
      try {
        await putDoc(db, { _id: id, type: "salt", salt: randomBytes(32).toString("hex"), createdAt: Date.now() });
      } catch (error) {
        if (!(error instanceof CouchError && error.status === 409)) throw error;
      }
      doc = await getDoc<{ salt: string }>(db, id);
    }
    if (!doc?.salt) throw new Error(`Unable to resolve analytics salt for ${day}`);
    memo.set(key, doc.salt);
    if (memo.size > 64) memo.delete(memo.keys().next().value as string);
    return doc.salt;
  })();
  pending.set(key, promise);
  try {
    return await promise;
  } finally {
    pending.delete(key);
  }
};

/** Pure visitor hash (64-bit hex). */
export const visitorHash = (salt: string, siteId: string, ip: string, userAgent: string): string =>
  createHash("sha256").update(`${salt}|${siteId}|${ip}|${userAgent}`).digest("hex").slice(0, 16);

/** Deletes salts older than `keepDays` days before `today`. */
export const purgeOldSalts = async (config: EngineConfig, today: string, keepDays = 2) => {
  const db = mainDb(config);
  const cutoff = addDays(today, -keepDays);
  const docs = await collectRange<{ _id: string; _rev: string }>(db, "salt:", `salt:${cutoff}`);
  for (const doc of docs) {
    if (doc._id < `salt:${cutoff}`) {
      await deleteDoc(db, doc._id, doc._rev).catch(() => undefined);
      for (const key of memo.keys()) if (key.endsWith(doc._id.slice(5))) memo.delete(key);
    }
  }
};

/** Test seam. */
export const resetSaltMemo = (): void => {
  memo.clear();
  pending.clear();
};
