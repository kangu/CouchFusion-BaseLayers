import type { CouchDBDocument } from "#database/utils/couchdb";
import type { BlinkNcRefreshResult } from "./blink-nc-payment-refresh";

export interface BlinkNcAttemptState {
  failures: number;
  nextAttemptAt: number;
}

export const getBlinkNcPollDelay = ({
  ageMs,
  phase,
  failures,
}: {
  ageMs: number;
  phase: "pending" | "grace";
  failures: number;
}): number => {
  const base = phase === "grace" ? 30_000 : ageMs <= 120_000 ? 3_000 : 10_000;
  return Math.min(30_000, base * (2 ** Math.max(0, failures)));
};

interface BatchOptions {
  invoiceDocs: CouchDBDocument[];
  attempts: Map<string, BlinkNcAttemptState>;
  runningState: { running: boolean };
  maxConcurrency: number;
  settlementGraceMs: number;
  now: Date;
  refresh: (doc: CouchDBDocument) => Promise<BlinkNcRefreshResult>;
  expire: (doc: CouchDBDocument) => Promise<BlinkNcRefreshResult>;
}

export interface BlinkNcBatchResult {
  checked: number;
  skipped: number;
  paid: number;
  expired: number;
  proofInvalid: number;
  failed: number;
}

interface LoadReconciliationDocsOptions {
  ordersDatabase: string;
  getView: (
    database: string,
    designDocument: string,
    viewName: string,
    options: Record<string, unknown>,
  ) => Promise<{ rows?: Array<{ doc?: CouchDBDocument }> }>;
}

/**
 * Loads unsettled invoices plus paid invoices whose downstream fulfillment did
 * not finish, allowing transient side-effect failures to recover automatically.
 */
export const loadBlinkNcReconciliationDocs = async (
  options: LoadReconciliationDocsOptions,
): Promise<CouchDBDocument[]> => {
  const pendingView = await options.getView(
    options.ordersDatabase,
    "lightning",
    "by_provider_and_status",
    { key: ["blink_nc", "pending"], include_docs: true },
  );
  const paidView = await options.getView(
    options.ordersDatabase,
    "lightning",
    "by_provider_and_status",
    { key: ["blink_nc", "paid"], include_docs: true },
  );
  const pendingDocs = (pendingView?.rows || []).map((row) => row.doc).filter(Boolean) as CouchDBDocument[];
  const incompletePaidDocs = (paidView?.rows || [])
    .map((row) => row.doc)
    .filter((doc): doc is CouchDBDocument => Boolean(
      doc
      && doc.fulfillment
      && doc.fulfillment.status !== "fulfilled",
    ));

  return [...pendingDocs, ...incompletePaidDocs];
};

const dateMs = (value: unknown): number => {
  if (value instanceof Date) return value.getTime();
  if (typeof value !== "string") return Number.NaN;
  return new Date(value).getTime();
};

export const reconcileBlinkNcBatch = async (options: BatchOptions): Promise<BlinkNcBatchResult> => {
  const result: BlinkNcBatchResult = { checked: 0, skipped: 0, paid: 0, expired: 0, proofInvalid: 0, failed: 0 };
  if (options.runningState.running) {
    result.skipped = options.invoiceDocs.length;
    return result;
  }
  options.runningState.running = true;
  const nowMs = options.now.getTime();

  const processOne = async (doc: CouchDBDocument) => {
    const key = String(doc._id || doc.payment?.providerInvoiceId || doc.invoiceData?.invoiceId || "");
    const previous = options.attempts.get(key) || { failures: 0, nextAttemptAt: 0 };
    if (previous.nextAttemptAt > nowMs) {
      result.skipped += 1;
      return;
    }
    result.checked += 1;
    const createdAt = dateMs(doc.payment?.createdAt || doc.createdAt || doc.timestamp);
    const expiresAt = dateMs(doc.payment?.expiresAt || doc.invoiceData?.expiresAt);
    const ageMs = Number.isNaN(createdAt) ? 0 : Math.max(0, nowMs - createdAt);
    const phase = !Number.isNaN(expiresAt) && nowMs >= expiresAt ? "grace" as const : "pending" as const;
    const pastGrace = !Number.isNaN(expiresAt) && nowMs > expiresAt + options.settlementGraceMs;
    try {
      const refreshed = await options.refresh(doc);
      if (refreshed.status === "paid") {
        result.paid += 1;
        options.attempts.delete(key);
        return;
      }
      if (refreshed.reason === "proof_invalid") result.proofInvalid += 1;
      if (pastGrace) {
        const expired = await options.expire(refreshed.invoiceDoc);
        if (expired.status === "expired") result.expired += 1;
        options.attempts.delete(key);
        return;
      }
      options.attempts.set(key, {
        failures: 0,
        nextAttemptAt: nowMs + getBlinkNcPollDelay({ ageMs, phase, failures: 0 }),
      });
    } catch {
      result.failed += 1;
      const failures = previous.failures + 1;
      options.attempts.set(key, {
        failures,
        nextAttemptAt: nowMs + getBlinkNcPollDelay({ ageMs, phase, failures }),
      });
    }
  };

  try {
    let cursor = 0;
    const workerCount = Math.max(1, Math.min(options.maxConcurrency, options.invoiceDocs.length));
    await Promise.all(Array.from({ length: workerCount }, async () => {
      while (cursor < options.invoiceDocs.length) {
        const doc = options.invoiceDocs[cursor];
        cursor += 1;
        if (doc) await processOne(doc);
      }
    }));
    return result;
  } finally {
    options.runningState.running = false;
  }
};
