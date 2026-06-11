export const ADMIN_LABELS_DOCUMENT_ID = 'settings:orders-admin-labels'

export const defaultAdminLabels = {
  ordersSectionLabel: 'Orders',
  productsTitle: 'Products',
  totalSuffix: 'total',
  activeSuffix: 'active',
  catalogTitle: 'Catalog',
  loadingProducts: 'Loading products...',
  emptyProducts: 'No products yet.',
  productColumn: 'Product',
  priceColumn: 'Price',
  stockColumn: 'Stock',
  statusColumn: 'Status',
  actionsColumn: 'Actions',
  editButton: 'Edit',
  archiveButton: 'Archive',
  newProductTitle: 'New product',
  editProductTitle: 'Edit product',
  resetButton: 'Reset',
  nameLabel: 'Name',
  slugLabel: 'Slug',
  descriptionLabel: 'Description',
  priceRonLabel: 'Price RON',
  stockLabel: 'Stock',
  statusLabel: 'Status',
  draftStatus: 'Draft',
  activeStatus: 'Active',
  archivedStatus: 'Archived',
  sortOrderLabel: 'Sort order',
  imageUrlLabel: 'Image URL',
  tagsLabel: 'Tags',
  imagekitTransformsLabel: 'ImageKit transforms',
  featuredLabel: 'Featured',
  createProductButton: 'Create product',
  saveProductButton: 'Save product',
  savingLabel: 'Saving...',
  productCreatedNotice: 'Product created.',
  productUpdatedNotice: 'Product updated.',
  productArchivedNotice: 'Product archived.',
  loadProductsError: 'Unable to load products.',
  saveProductError: 'Unable to save product.',
  archiveProductError: 'Unable to archive product.',
} as const

export type OrdersAdminLabels = typeof defaultAdminLabels

export interface OrdersAdminLabelsDocument {
  _id: typeof ADMIN_LABELS_DOCUMENT_ID
  _rev?: string
  type: 'orders_admin_labels'
  labels: OrdersAdminLabels
  updatedAt: string
}

const toRecord = (value: unknown): Record<string, unknown> => {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

export const normalizeAdminLabelsDocument = (
  input: unknown,
  existing?: OrdersAdminLabelsDocument | null,
): OrdersAdminLabelsDocument => {
  const source = toRecord(input)
  const sourceLabels = toRecord(source.labels)
  const labels = { ...defaultAdminLabels }

  for (const key of Object.keys(defaultAdminLabels) as Array<keyof OrdersAdminLabels>) {
    const candidate = sourceLabels[key]
    if (typeof candidate === 'string' && candidate.trim()) {
      labels[key] = candidate.trim() as OrdersAdminLabels[typeof key]
    }
  }

  return {
    _id: ADMIN_LABELS_DOCUMENT_ID,
    ...(existing?._rev ? { _rev: existing._rev } : {}),
    type: 'orders_admin_labels',
    labels,
    updatedAt: new Date().toISOString(),
  }
}
