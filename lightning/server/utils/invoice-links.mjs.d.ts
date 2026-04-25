export function buildLightningInvoiceLinkDocument(options: Record<string, any>): Record<string, any>
export function saveLightningInvoiceLink(options: Record<string, any>): Promise<Record<string, any>>
export function applyWebhookStatusToLinkedDocument(
  doc: Record<string, any>,
  link: Record<string, any>,
  webhookEvent: Record<string, any>,
  now?: Date
): Record<string, any>
export function updateLinkedInvoiceDocuments(options: Record<string, any>): Promise<{
  invoiceId: string
  matched: number
  updated: number
  updates: Array<Record<string, any>>
}>
