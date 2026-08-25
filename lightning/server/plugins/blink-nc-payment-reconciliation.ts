import { getDocument, getView, putDocument, type CouchDBDocument } from "#database/utils/couchdb";
import { createLightningService } from "../../services/lightning";
import { updateLinkedInvoiceDocuments } from "../utils/invoice-links";
import { applyInvoicePaidFulfillment } from "../utils/order-fulfillment";
import { paymentEventBus } from "../utils/payment-event-bus";
import {
  beginPaymentEventProcessing,
  markPaymentEventFailed,
  markPaymentEventProcessed,
} from "../utils/payment-event-log";
import { expireUnsettledBlinkNcInvoice, refreshBlinkNcInvoice } from "../utils/blink-nc-payment-refresh";
import {
  loadBlinkNcReconciliationDocs,
  reconcileBlinkNcBatch,
  type BlinkNcAttemptState,
} from "../utils/blink-nc-reconciliation";
import { resolveLightningConfig } from "../utils/lightning-config";

const STATE_KEY = Symbol.for("couchfusion.lightning.blink_nc.reconciliation");
type RuntimeState = {
  timer?: ReturnType<typeof setInterval>;
  running: boolean;
  attempts: Map<string, BlinkNcAttemptState>;
};

const getState = (): RuntimeState => {
  const root = globalThis as typeof globalThis & { [STATE_KEY]?: RuntimeState };
  return root[STATE_KEY] ||= { running: false, attempts: new Map() };
};

export default defineNitroPlugin(async () => {
  const runtimeConfig = useRuntimeConfig();
  if (!runtimeConfig.dbLoginPrefix) return;
  const config = await resolveLightningConfig(runtimeConfig);
  const providerConfig = config.providers.blink_nc;
  if (!providerConfig) return;
  const state = getState();
  if (state.timer) return;
  const ordersDatabase = `${runtimeConfig.dbLoginPrefix}-orders`;
  const service = createLightningService(config);
  const provider = service.getProvider("blink_nc") as { probeConnection?: () => Promise<Record<string, number>> };

  const common = (invoiceDoc: CouchDBDocument) => ({
    ordersDatabase,
    invoiceDoc,
    getInvoiceStatus: (invoiceId: string, context: any) => service.getInvoiceStatus(invoiceId, "blink_nc", context),
    getDocument,
    putDocument,
    beginEvent: (options: Record<string, unknown>) => beginPaymentEventProcessing(
      options as unknown as Parameters<typeof beginPaymentEventProcessing>[0],
    ),
    markEventProcessed: markPaymentEventProcessed,
    markEventFailed: markPaymentEventFailed,
    updateLinks: (options: Record<string, unknown>) => updateLinkedInvoiceDocuments({
      ...options,
      getView,
      getDocument,
      putDocument,
    }),
    fulfillPaid: applyInvoicePaidFulfillment,
    publish: paymentEventBus.publish,
  });

  const reconcile = async () => {
    if (state.running) return;
    try {
      const invoiceDocs = await loadBlinkNcReconciliationDocs({
        ordersDatabase,
        getView,
      });
      const result = await reconcileBlinkNcBatch({
        invoiceDocs,
        attempts: state.attempts,
        runningState: state,
        maxConcurrency: providerConfig.maxConcurrency,
        settlementGraceMs: providerConfig.settlementGraceMs,
        now: new Date(),
        refresh: (doc) => refreshBlinkNcInvoice(common(doc)),
        expire: (doc) => expireUnsettledBlinkNcInvoice(common(doc)),
      });
      if (result.paid || result.expired || result.failed || result.proofInvalid) {
        console.info("[lightning][blink_nc] reconciliation batch", result);
      }
    } catch (error) {
      console.warn("[lightning][blink_nc] reconciliation unavailable", error instanceof Error ? error.message : "unknown error");
    }
  };

  try {
    const capabilities = await provider.probeConnection?.();
    console.info("[lightning][blink_nc] strict-proof reconciliation configured", {
      ...capabilities,
      reconcileIntervalMs: providerConfig.reconcileIntervalMs,
      settlementGraceMs: providerConfig.settlementGraceMs,
      maxConcurrency: providerConfig.maxConcurrency,
    });
  } catch (error) {
    console.warn("[lightning][blink_nc] metadata probe failed", error instanceof Error ? error.message : "unknown error");
  }

  state.timer = setInterval(reconcile, providerConfig.reconcileIntervalMs);
  (state.timer as unknown as { unref?: () => void }).unref?.();
  void reconcile();
});
