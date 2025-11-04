/**
 * Order processing utilities for lightning purchases
 * Handles order document creation and management
 */

import {putDocument, getSession, getDocument} from '#database/utils/couchdb'
import {getHeader} from 'h3'
import crypto from 'crypto'
import type {InvoiceResponse} from '../types/lightning'

// Type definitions
export interface ProductInfo {
    memo: string;
    sats: number;
    valid_days?: number;
    [key: string]: unknown;
}

export interface OrderDocument {
    _id: string;
    type: 'purchase';
    timestamp: string;
    content: any;
    userName: string;
    status: 'pending' | 'active' | 'pending_payment' | 'expired'
}

export interface CreateOrderOptions {
    payload: any;
    event: any; // H3 event object
    databaseName: string;
}

export interface InvoiceDocument {
    _id: string;
    type: 'invoice';
    timestamp: string;
    orderId: string;
    invoiceData: InvoiceResponse;
    userName: string;
    lastEvent: string;
    email?: string
}

export interface SaveInvoiceOptions {
    invoiceData: InvoiceResponse;
    orderId: string;
    event: any; // H3 event object
    databaseName: string;
}

/**
 * Generate a random ID for purchase orders
 */
function generatePurchaseId(): string {
    return `purchase-${crypto.randomBytes(8).toString('hex')}`
}

/**
 * Extract AuthSession cookie value from cookie header
 */
function extractAuthSessionCookie(cookieHeader: string | undefined): string | null {
    if (!cookieHeader) return null

    const cookies = cookieHeader.split(';')
    for (const cookie of cookies) {
        const trimmed = cookie.trim()
        if (trimmed.startsWith('AuthSession=')) {
            return trimmed.substring('AuthSession='.length)
        }
    }

    return null
}

/**
 * Get current user name from session
 */
async function getCurrentUserName(event: any): Promise<string> {
    const cookieHeader = getHeader(event, 'cookie')
    const authSessionCookie = extractAuthSessionCookie(cookieHeader)

    if (!authSessionCookie) {
        throw new Error('No valid session cookie found')
    }

    const sessionResponse = await getSession({authSessionCookie})

    if (!sessionResponse || !sessionResponse.userCtx?.name) {
        throw new Error('Invalid or expired session')
    }

    return sessionResponse.userCtx.name
}

/**
 * Create an order document in the orders database
 *
 * @param options - Order creation options
 * @returns Promise that resolves to the created order document ID
 */
export async function createOrder(options: CreateOrderOptions): Promise<string> {
    const {payload, event, databaseName} = options

    // Generate unique purchase ID
    const purchaseId = generatePurchaseId()

    // Get current user name from session
    const userName = await getCurrentUserName(event)

    // Create order document
    const orderDocument: OrderDocument = {
        _id: purchaseId,
        type: 'purchase',
        status: 'pending',
        timestamp: new Date().toISOString(),
        content: payload,
        userName
    }

    // Save to database
    const result = await putDocument(databaseName, orderDocument)

    if (!result.ok) {
        throw new Error(`Failed to create order document: ${result.error}`)
    }

    return purchaseId
}

/**
 * Replace template placeholders in memo with values from payload
 * Supports {{key}} pattern replacement
 */
export function replaceMemoTemplate(memo: string, payload: Record<string, any>): string {
    return memo.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        return payload[key] !== undefined ? String(payload[key]) : match
    })
}

/**
 * Get product info (memo and sats) from products document
 * Throws regular Error objects that should be converted to HTTP errors by caller
 */
export async function getProductPrice(product: string, databaseName: string): Promise<ProductInfo> {
    // Load products document
    const productsDoc = await getDocument(databaseName, 'products')

    if (!productsDoc) {
        throw new Error('Products document not found')
    }

    // Check if product exists in document
    if (!(product in productsDoc)) {
        throw new Error(`Product "${product}" not found`)
    }

    const productData = productsDoc[product]

    // Check if product has the expected structure
    if (!productData || typeof productData !== 'object') {
        throw new Error(`Product "${product}" has invalid structure: expected object with memo and sats`)
    }

    const { memo, sats } = productData as {
        memo?: unknown;
        sats?: unknown;
    }

    if (typeof memo !== 'string' || typeof sats !== 'number') {
        throw new Error(`Product "${product}" has invalid structure: expected memo (string) and sats (number)`)
    }

    // Validate that price is positive
    if (sats <= 0) {
        throw new Error(`Product "${product}" has invalid price: must be positive`)
    }

    return productData as ProductInfo
}

/**
 * Save invoice data to the orders database
 *
 * @param options - Invoice save options
 * @returns Promise that resolves to the created invoice document ID
 */
export async function saveInvoiceToDatabase(options: SaveInvoiceOptions): Promise<string> {
    const {invoiceData, orderId, event, databaseName} = options

    // Generate unique invoice document ID
    const invoiceDocId = `invoice-${invoiceData.id}`

    // Get current user name from session
    const userName = await getCurrentUserName(event)

    // Also get user doc email
    const userDoc = await getDocument('_users', `org.couchdb.user:${userName}`)

    // Create invoice document
    const invoiceDocument: InvoiceDocument = {
        _id: invoiceDocId,
        type: 'invoice',
        timestamp: new Date().toISOString(),
        orderId: orderId,
        invoiceData: invoiceData,
        userName: userName,
        email: userDoc.email,
        lastEvent: 'created'
    }

    // Save to database
    const result = await putDocument(databaseName, invoiceDocument)

    if (!result.ok) {
        throw new Error(`Failed to save invoice document: ${result.error}`)
    }

    return invoiceDocId
}
