export function safeRedirect(value: unknown, fallback = '/admin'): string {
  if (
    typeof value !== 'string' ||
    !value.startsWith('/') ||
    value.startsWith('//')
  )
    return fallback
  try {
    const decoded = decodeURIComponent(value)
    if (decoded.startsWith('//') || /[\\\x00-\x20]/.test(decoded))
      return fallback
    if (
      new URL(value, 'https://local.invalid').origin !== 'https://local.invalid'
    )
      return fallback
    return value
  } catch {
    return fallback
  }
}
