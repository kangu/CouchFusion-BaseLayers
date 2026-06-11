export type ProductStatus = 'draft' | 'active' | 'archived'

export interface OrdersProductDocument {
  _id: string
  _rev?: string
  type: 'orders_product'
  name: string
  slug: string
  description: string
  priceRon: number
  currency: 'RON'
  stock: number
  status: ProductStatus
  tags: string[]
  image: string
  imageImagekitTransforms: string[]
  sortOrder: number
  featured: boolean
  createdAt: string
  updatedAt: string
}

export interface PublicProduct {
  id: string
  slug: string
  name: string
  description: string
  price: string
  priceRon: number
  currency: 'RON'
  stock: number
  stockLabel: string
  status: ProductStatus
  image: string
  tags: string[]
  ctaLabel: string
  ctaHref: string
  imageImagekitTransforms: string[]
  featured: boolean
  sortOrder: number
}

export interface CashOnDeliveryPurchaseDocument {
  _id: string
  _rev?: string
  type: 'purchase'
  status: 'pending_confirmation'
  timestamp: string
  createdAt: string
  updatedAt: string
  payment: {
    method: 'cash_on_delivery'
    status: 'pending_collection'
  }
  fulfillment: {
    method: 'delivery'
    status: 'pending'
  }
  customer: {
    name: string
    phone: string
    email?: string
  }
  deliveryAddress: {
    addressLine1: string
    addressLine2?: string
    city: string
    county?: string
    postalCode?: string
    notes?: string
  }
  items: Array<{
    productId: string
    slug: string
    name: string
    quantity: number
    unitPrice: number
    lineTotal: number
    currency: 'RON'
  }>
  totals: {
    subtotal: number
    shipping: number
    total: number
    currency: 'RON'
  }
}

export interface ProductInput {
  _id?: unknown
  _rev?: unknown
  name?: unknown
  slug?: unknown
  description?: unknown
  priceRon?: unknown
  currency?: unknown
  stock?: unknown
  status?: unknown
  tags?: unknown
  image?: unknown
  imageImagekitTransforms?: unknown
  sortOrder?: unknown
  featured?: unknown
  createdAt?: unknown
}

const PRODUCT_TYPE = 'orders_product' as const
const DEFAULT_IMAGE_TRANSFORMS: string[] = []

const toTrimmedString = (value: unknown): string => {
  return typeof value === 'string' ? value.trim() : ''
}

export const slugifyProductName = (value: unknown): string => {
  const base = toTrimmedString(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return base || `product-${Date.now()}`
}

const toNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number.parseFloat(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }
  return fallback
}

const toInteger = (value: unknown, fallback = 0): number => {
  return Math.max(0, Math.trunc(toNumber(value, fallback)))
}

const toStatus = (value: unknown): ProductStatus => {
  return value === 'draft' || value === 'archived' || value === 'active'
    ? value
    : 'draft'
}

const toStringList = (value: unknown): string[] => {
  const source = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : []
  const seen = new Set<string>()
  const result: string[] = []

  for (const item of source) {
    const normalized = toTrimmedString(item)
    if (!normalized || seen.has(normalized)) {
      continue
    }
    seen.add(normalized)
    result.push(normalized)
  }

  return result
}

export const normalizeProductInput = (
  input: ProductInput,
  existing?: OrdersProductDocument | null,
): OrdersProductDocument => {
  const now = new Date().toISOString()
  const name = toTrimmedString(input.name) || existing?.name || 'Untitled product'
  const slug = slugifyProductName(input.slug || existing?.slug || name)
  const createdAt =
    toTrimmedString(input.createdAt) ||
    existing?.createdAt ||
    now

  return {
    _id: `product:${slug}`,
    ...(typeof input._rev === 'string' ? { _rev: input._rev } : existing?._rev ? { _rev: existing._rev } : {}),
    type: PRODUCT_TYPE,
    name,
    slug,
    description: toTrimmedString(input.description) || existing?.description || '',
    priceRon: Math.max(0, toNumber(input.priceRon, existing?.priceRon ?? 0)),
    currency: 'RON',
    stock: toInteger(input.stock, existing?.stock ?? 0),
    status: toStatus(input.status ?? existing?.status),
    tags: toStringList(input.tags ?? existing?.tags),
    image: toTrimmedString(input.image) || existing?.image || '/placeholder.svg?height=400&width=400',
    imageImagekitTransforms: toStringList(
      input.imageImagekitTransforms ?? existing?.imageImagekitTransforms ?? DEFAULT_IMAGE_TRANSFORMS,
    ),
    sortOrder: toInteger(input.sortOrder, existing?.sortOrder ?? 0),
    featured: Boolean(input.featured ?? existing?.featured ?? false),
    createdAt,
    updatedAt: now,
  }
}

export const isOrdersProductDocument = (
  value: unknown,
): value is OrdersProductDocument => {
  return Boolean(
    value &&
    typeof value === 'object' &&
    (value as { type?: unknown }).type === PRODUCT_TYPE &&
    typeof (value as { _id?: unknown })._id === 'string',
  )
}

export const toPublicProduct = (product: OrdersProductDocument): PublicProduct => {
  return {
    id: product._id,
    slug: product.slug,
    name: product.name,
    description: product.description,
    price: `${product.priceRon} ${product.currency}`,
    priceRon: product.priceRon,
    currency: product.currency,
    stock: product.stock,
    stockLabel: String(product.stock),
    status: product.status,
    image: product.image,
    tags: [...product.tags],
    ctaLabel: 'Add',
    ctaHref: '/products/1',
    imageImagekitTransforms: [...product.imageImagekitTransforms],
    featured: product.featured,
    sortOrder: product.sortOrder,
  }
}

export interface CashOnDeliveryInput {
  products: OrdersProductDocument[]
  items: Array<{
    productId?: unknown
    slug?: unknown
    quantity?: unknown
  }>
  customer: {
    name?: unknown
    phone?: unknown
    email?: unknown
  }
  deliveryAddress: {
    addressLine1?: unknown
    addressLine2?: unknown
    city?: unknown
    county?: unknown
    postalCode?: unknown
    notes?: unknown
  }
  now?: string
  idSuffix?: string
}

export const buildCashOnDeliveryPurchase = (
  input: CashOnDeliveryInput,
): {
  purchase: CashOnDeliveryPurchaseDocument
  updatedProducts: OrdersProductDocument[]
} => {
  const customerName = toTrimmedString(input.customer.name)
  const customerPhone = toTrimmedString(input.customer.phone)
  const addressLine1 = toTrimmedString(input.deliveryAddress.addressLine1)
  const city = toTrimmedString(input.deliveryAddress.city)

  if (!customerName || !customerPhone || !addressLine1 || !city) {
    throw new Error('Missing required cash-on-delivery customer or delivery fields')
  }

  const byId = new Map(input.products.map((product) => [product._id, product]))
  const bySlug = new Map(input.products.map((product) => [product.slug, product]))
  const updatedById = new Map<string, OrdersProductDocument>()
  const purchaseItems: CashOnDeliveryPurchaseDocument['items'] = []

  for (const item of input.items) {
    const quantity = toInteger(item.quantity, 1)
    const productKey = toTrimmedString(item.productId)
    const slug = toTrimmedString(item.slug)
    const product = byId.get(productKey) ?? bySlug.get(slug)

    if (!product || product.status !== 'active') {
      throw new Error('Product is not available')
    }
    if (quantity < 1) {
      throw new Error('Quantity must be at least 1')
    }

    const pendingProduct = updatedById.get(product._id) ?? product
    if (pendingProduct.stock < quantity) {
      throw new Error('Insufficient product stock')
    }

    const nextStock = pendingProduct.stock - quantity
    updatedById.set(product._id, {
      ...pendingProduct,
      stock: nextStock,
      updatedAt: input.now ?? new Date().toISOString(),
    })

    purchaseItems.push({
      productId: product._id,
      slug: product.slug,
      name: product.name,
      quantity,
      unitPrice: product.priceRon,
      lineTotal: product.priceRon * quantity,
      currency: 'RON',
    })
  }

  if (purchaseItems.length === 0) {
    throw new Error('At least one product is required')
  }

  const now = input.now ?? new Date().toISOString()
  const idSuffix = input.idSuffix ?? Math.random().toString(36).slice(2, 10)
  const subtotal = purchaseItems.reduce((total, item) => total + item.lineTotal, 0)
  const shipping = 0

  return {
    purchase: {
      _id: `order:${now}:${idSuffix}`,
      type: 'purchase',
      status: 'pending_confirmation',
      timestamp: now,
      createdAt: now,
      updatedAt: now,
      payment: {
        method: 'cash_on_delivery',
        status: 'pending_collection',
      },
      fulfillment: {
        method: 'delivery',
        status: 'pending',
      },
      customer: {
        name: customerName,
        phone: customerPhone,
        ...(toTrimmedString(input.customer.email) ? { email: toTrimmedString(input.customer.email) } : {}),
      },
      deliveryAddress: {
        addressLine1,
        ...(toTrimmedString(input.deliveryAddress.addressLine2)
          ? { addressLine2: toTrimmedString(input.deliveryAddress.addressLine2) }
          : {}),
        city,
        ...(toTrimmedString(input.deliveryAddress.county) ? { county: toTrimmedString(input.deliveryAddress.county) } : {}),
        ...(toTrimmedString(input.deliveryAddress.postalCode)
          ? { postalCode: toTrimmedString(input.deliveryAddress.postalCode) }
          : {}),
        ...(toTrimmedString(input.deliveryAddress.notes) ? { notes: toTrimmedString(input.deliveryAddress.notes) } : {}),
      },
      items: purchaseItems,
      totals: {
        subtotal,
        shipping,
        total: subtotal + shipping,
        currency: 'RON',
      },
    },
    updatedProducts: Array.from(updatedById.values()),
  }
}
