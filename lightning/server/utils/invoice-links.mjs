export const buildLightningInvoiceLinkDocument = (options) => ({
  _id: `lightning-invoice-link:${options.invoiceId}:${options.purpose}:${options.documentId}`,
  type: 'lightning_invoice_link',
  invoiceId: options.invoiceId,
  provider: options.provider,
  purpose: options.purpose,
  databaseName: options.databaseName,
  documentId: options.documentId,
  documentType: options.documentType,
  statusField: options.statusField || 'status',
  paidAtField: options.paidAtField || 'paidAt',
  createdAt: options.createdAt || new Date().toISOString(),
  updatedAt: options.updatedAt || options.createdAt || new Date().toISOString()
})

export const saveLightningInvoiceLink = async (options) => {
  const doc = buildLightningInvoiceLinkDocument(options)
  await options.putDocument(options.registryDatabaseName, doc)
  return doc
}

export const applyWebhookStatusToLinkedDocument = (doc, link, webhookEvent, now = new Date()) => {
  const status = webhookEvent.status
  const updated = {
    ...doc,
    [link.statusField || 'status']: status,
    updatedAt: now.toISOString(),
    lastLightningEvent: {
      invoiceId: webhookEvent.invoiceId,
      status,
      provider: webhookEvent.metadata?.provider || link.provider || null,
      timestamp: webhookEvent.timestamp
        ? new Date(webhookEvent.timestamp).toISOString()
        : now.toISOString()
    }
  }

  if (status === 'paid' && (link.paidAtField || 'paidAt')) {
    updated[link.paidAtField || 'paidAt'] = updated[link.paidAtField || 'paidAt'] || now.toISOString()
  }

  return updated
}

export const updateLinkedInvoiceDocuments = async (options) => {
  const view = await options.getView(options.registryDatabaseName, 'lightning', 'invoice_links_by_invoice_id', {
    key: options.webhookEvent.invoiceId,
    include_docs: true
  })
  const links = (view?.rows || []).map((row) => row.doc).filter(Boolean)
  const updates = []

  for (const link of links) {
    const doc = await options.getDocument(link.databaseName, link.documentId)
    if (!doc) {
      continue
    }

    const updated = applyWebhookStatusToLinkedDocument(doc, link, options.webhookEvent, options.now)
    const response = await options.putDocument(link.databaseName, updated)
    updates.push({
      linkId: link._id,
      databaseName: link.databaseName,
      documentId: link.documentId,
      status: updated[link.statusField || 'status'],
      rev: response?.rev || null
    })
  }

  return {
    invoiceId: options.webhookEvent.invoiceId,
    matched: links.length,
    updated: updates.length,
    updates
  }
}
