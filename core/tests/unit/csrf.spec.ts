import { it, expect } from 'vitest'
import { createCsrfToken } from '../../src/server/csrf'
it('is stable across workers and bound to the caller session and bootstrap secret', () => {
  const a = createCsrfToken('session-a', 'secret'),
    b = createCsrfToken('session-a', 'secret')
  expect(a).toBe(b)
  expect(a).not.toBe(createCsrfToken('session-b', 'secret'))
  expect(a).not.toBe(createCsrfToken('session-a', 'rotated-secret'))
  expect(a).not.toContain('secret')
})
