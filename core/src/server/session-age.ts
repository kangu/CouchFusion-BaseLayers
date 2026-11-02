/** Check age only after CouchDB has authenticated the token's signature and identity. */
export function isWithinSessionAge(
  token: string,
  username: string,
  maxAge: number,
  now = Math.floor(Date.now() / 1000),
) {
  try {
    const bytes = Buffer.from(token, 'base64url'),
      prefix = Buffer.from(username + ':')
    if (!bytes.subarray(0, prefix.length).equals(prefix)) return false
    const end = bytes.indexOf(58, prefix.length)
    if (end < 0) return false
    const value = bytes.subarray(prefix.length, end).toString('ascii')
    if (!/^[a-f0-9]+$/i.test(value)) return false
    const stamp = Number.parseInt(value, 16),
      age = now - stamp
    return Number.isSafeInteger(stamp) && age >= -30 && age <= maxAge
  } catch {
    return false
  }
}
