import { it, expect } from 'vitest'
import { isWithinSessionAge } from '../../src/server/session-age'
it('enforces configured age after native validation, without future dating', () => {
  const token = Buffer.from(
    'user:' + Math.floor(1000).toString(16) + ':signature',
  ).toString('base64url')
  expect(isWithinSessionAge(token, 'user', 60, 1050)).toBe(true)
  expect(isWithinSessionAge(token, 'user', 60, 1061)).toBe(false)
  expect(isWithinSessionAge(token, 'other', 60, 1050)).toBe(false)
  expect(isWithinSessionAge(token, 'user', 60, 900)).toBe(false)
  expect(isWithinSessionAge('invalid', 'user', 60, 1050)).toBe(false)
})
