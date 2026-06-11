import { describe, expect, it } from 'vitest'
import {
  buildCashOnDeliveryPurchase,
  normalizeProductInput,
  toPublicProduct,
} from '../server/utils/catalog'

describe('orders catalog helpers', () => {
  it('normalizes product input for storage', () => {
    const product = normalizeProductInput({
      name: ' Bratara Minunea Mustatilor ',
      slug: ' bratara-minunea-mustatilor ',
      description: 'Handmade bracelet',
      priceRon: '45',
      stock: '8',
      status: 'active',
      tags: ['cats', 'sparkly', 'cats'],
      image: '/products/bracelet.jpg',
      sortOrder: '2',
      featured: true,
    })

    expect(product).toMatchObject({
      _id: 'product:bratara-minunea-mustatilor',
      type: 'orders_product',
      name: 'Bratara Minunea Mustatilor',
      slug: 'bratara-minunea-mustatilor',
      priceRon: 45,
      currency: 'RON',
      stock: 8,
      status: 'active',
      tags: ['cats', 'sparkly'],
      image: '/products/bracelet.jpg',
      sortOrder: 2,
      featured: true,
    })
    expect(product.createdAt).toBeTruthy()
    expect(product.updatedAt).toBe(product.createdAt)
  })

  it('maps only public product fields for the storefront', () => {
    const product = normalizeProductInput({
      name: 'Rainbow Paw Necklace',
      description: 'Colorful necklace',
      priceRon: 55,
      stock: 6,
      status: 'active',
      tags: ['rainbow'],
      image: '/products/rainbow.jpg',
    })

    expect(toPublicProduct(product)).toEqual({
      id: product._id,
      slug: product.slug,
      name: 'Rainbow Paw Necklace',
      description: 'Colorful necklace',
      price: '55 RON',
      priceRon: 55,
      currency: 'RON',
      stock: 6,
      stockLabel: '6',
      status: 'active',
      image: '/products/rainbow.jpg',
      tags: ['rainbow'],
      ctaLabel: 'Add',
      ctaHref: '/products/1',
      imageImagekitTransforms: [],
      featured: false,
      sortOrder: 0,
    })
  })

  it('builds a cash-on-delivery purchase and decrements product stock', () => {
    const bracelet = normalizeProductInput({
      name: 'Bracelet',
      description: 'Handmade',
      priceRon: 45,
      stock: 8,
      status: 'active',
    })
    const earrings = normalizeProductInput({
      name: 'Earrings',
      description: 'Handmade',
      priceRon: 35,
      stock: 12,
      status: 'active',
    })

    const result = buildCashOnDeliveryPurchase({
      products: [bracelet, earrings],
      items: [
        { productId: bracelet._id, quantity: 2 },
        { productId: earrings._id, quantity: 1 },
      ],
      customer: {
        name: 'Radu',
        phone: '0700000000',
        email: '',
      },
      deliveryAddress: {
        addressLine1: 'Strada Exemplu 1',
        city: 'Bucuresti',
      },
      now: '2026-05-30T10:00:00.000Z',
      idSuffix: 'abc123',
    })

    expect(result.purchase).toMatchObject({
      _id: 'order:2026-05-30T10:00:00.000Z:abc123',
      type: 'purchase',
      status: 'pending_confirmation',
      payment: {
        method: 'cash_on_delivery',
        status: 'pending_collection',
      },
      totals: {
        subtotal: 125,
        shipping: 0,
        total: 125,
        currency: 'RON',
      },
    })
    expect(result.purchase.items).toHaveLength(2)
    expect(result.updatedProducts).toEqual([
      expect.objectContaining({ _id: bracelet._id, stock: 6 }),
      expect.objectContaining({ _id: earrings._id, stock: 11 }),
    ])
  })
})
