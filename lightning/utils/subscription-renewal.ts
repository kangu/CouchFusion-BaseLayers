/** Products whose successful payments establish a personal renewal rate. */
export const subscriptionProducts = ['pow_lab', 'pow_lab_lite'] as const

/** Parses a positive whole-satoshi amount without accepting partial strings. */
export const renewalSats = (value: unknown): number | null => {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  if (typeof value === 'string' && !value.trim()) return null
  const amount = Number(value)
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null
}

/** Returns one calendar month after expiration, clamping to the last UTC day. */
export const renewalResetAt = (value: unknown): number | null => {
  if (typeof value !== 'string' || !value.trim()) return null
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return null
  const day = date.getUTCDate()
  date.setUTCDate(1)
  date.setUTCMonth(date.getUTCMonth() + 1)
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate()
  date.setUTCDate(Math.min(day, lastDay))
  return date.getTime()
}

/** Resolves the locked price, enforcing expiry even when cron has not run yet. */
export const subscriptionRenewalPrice = (user: Record<string, unknown>, product: string, now = Date.now()): number | null => {
  const cutoff = renewalResetAt(user[`${product}_valid_until`])
  if (cutoff !== null && now >= cutoff) return null
  return renewalSats(user[`${product}_renewal_price`])
}

/** Converts provider invoice amounts into sats, with the stored order as fallback. */
export const paidSubscriptionSats = (invoice: Record<string, any>, order: Record<string, any>): number | null => {
  for (const payment of [invoice.invoiceData, invoice.payment]) {
    const currency = String(payment?.currency || '').toLowerCase()
    if (!['sats', 'sat', 'btc'].includes(currency)) continue
    const amount = Number(payment?.amount) * (currency === 'btc' ? 100_000_000 : 1)
    const rounded = Math.round(amount)
    if (Number.isFinite(amount) && Math.abs(amount - rounded) < 0.00001 && renewalSats(rounded)) return rounded
  }
  return renewalSats(order.content?.sats)
}
