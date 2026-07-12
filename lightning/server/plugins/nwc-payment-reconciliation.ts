import { getDocument, getView, putDocument, type CouchDBDocument } from "#database/utils/couchdb";
import { createLightningService } from "../../services/lightning";
import { applyInvoicePaidFulfillment } from "../utils/order-fulfillment";
import { paymentEventBus } from "../utils/payment-event-bus";
import { refreshNwcInvoice } from "../utils/nwc-payment-refresh";
import { resolveLightningConfig } from "../utils/lightning-config";

const STATE_KEY = Symbol.for("couchfusion.lightning.nwc.reconciliation");
type NwcProviderRuntime = {
  subscribeToPayments?: (handler: (invoiceId: string) => void | Promise<void>) => Promise<() => void>
  getNwcConnectionInfo?: () => Promise<{ methods: string[]; notifications: string[] }>
};
type RuntimeState = { timer?: ReturnType<typeof setInterval>; running: boolean; unsubscribe?: () => void };

const getState = (): RuntimeState => {
  const globalState = globalThis as typeof globalThis & { [STATE_KEY]?: RuntimeState };
  return globalState[STATE_KEY] ||= { running: false };
};

export default defineNitroPlugin(async () => {
  const runtimeConfig = useRuntimeConfig();
  if (!runtimeConfig.dbLoginPrefix) return;
  const config = await resolveLightningConfig(runtimeConfig);
  if (config.defaultProvider !== "nwc") return;
  const state = getState();
  if (state.timer) return;
  const ordersDatabase = `${runtimeConfig.dbLoginPrefix}-orders`;
  const service = createLightningService(config);

  const refresh = async (invoiceDoc: CouchDBDocument) => refreshNwcInvoice({
    ordersDatabase, invoiceDoc,
    getInvoiceStatus: (invoiceId: string) => service.getInvoiceStatus(invoiceId, "nwc"),
    getDocument,
    putDocument,
    fulfillPaid: applyInvoicePaidFulfillment,
    publish: paymentEventBus.publish,
  });
  const refreshByInvoiceId = async (invoiceId: string) => {
    const invoiceDoc = await getDocument<CouchDBDocument>(ordersDatabase, `invoice-${invoiceId}`);
    if (invoiceDoc) await refresh(invoiceDoc);
  };
  const reconcile = async () => {
    if (state.running) return;
    state.running = true;
    try {
      const result = await getView(ordersDatabase, "lightning", "by_provider_and_status", { key: ["nwc", "pending"], include_docs: true });
      for (const row of result?.rows || []) if (row.doc) await refresh(row.doc as CouchDBDocument);
    } catch (error) {
      console.warn("[lightning] NWC reconciliation failed", error instanceof Error ? error.message : "unknown error");
    } finally { state.running = false; }
  };
  const provider = service.getProvider("nwc") as NwcProviderRuntime;
  if (provider.getNwcConnectionInfo) {
    try {
      const info = await provider.getNwcConnectionInfo();
      console.info("[lightning][nwc] wallet capabilities", {
        methods: info.methods,
        notifications: info.notifications,
        paymentReceivedSupported: info.notifications.includes("payment_received"),
      });
    } catch (error) {
      console.warn("[lightning][nwc] wallet capability probe failed", error instanceof Error ? error.message : "unknown error");
    }
  }
  if (provider.subscribeToPayments) {
    state.unsubscribe = await provider.subscribeToPayments(async (invoiceId) => {
      console.info("[lightning][nwc] payment notification received", { invoiceId });
      await refreshByInvoiceId(invoiceId);
    });
    console.info("[lightning][nwc] payment notification subscription active");
  }
  const interval = config.providers.nwc?.reconcileIntervalMs || 60_000;
  state.timer = setInterval(reconcile, interval);
  state.timer.unref?.();
  console.info("[lightning][nwc] reconciliation started", { intervalMs: interval });
  void reconcile();
});
