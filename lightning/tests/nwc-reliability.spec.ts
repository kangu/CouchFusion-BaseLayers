import { describe, expect, it } from "vitest";

describe("NWC reliability foundations", () => {
  it("indexes provider and status from persisted invoiceData", async () => {
    const { lightningDesignDocument } = await import("../utils/design-documents");
    expect(lightningDesignDocument.views.by_provider.map).toContain("doc.invoiceData && doc.invoiceData.provider");
    expect(lightningDesignDocument.views.by_provider_and_status.map).toContain("doc.invoiceData && doc.invoiceData.provider");
    expect(lightningDesignDocument.views.by_provider_and_status.map).toContain("doc.invoiceData && doc.invoiceData.status");
  });

  it("does not let the generic one-hour expiry race an NWC invoice", async () => {
    const { isStalePendingInvoice } = await import("../server/utils/pending-invoice-expiration");
    expect(isStalePendingInvoice({
      type: "lightning_invoice",
      timestamp: "2026-01-01T00:00:00.000Z",
      invoiceData: { provider: "nwc", status: "pending" },
    } as any, new Date("2026-01-01T02:00:00.000Z"))).toBe(false);
  });
});
