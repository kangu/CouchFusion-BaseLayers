import { describe, expect, it } from 'vitest'
import {
  createContentPageRedirectMeta,
  parseContentPageRedirect,
} from '../utils/page-redirect'

describe('content page redirect metadata', () => {
  it('normalizes an internal redirect target', () => {
    expect(parseContentPageRedirect({ redirectTo: ' /new-page/ ' }, '/old-page')).toEqual({
      status: 'valid',
      targetPath: '/new-page',
    })
  })

  it.each(['/old-page', 'https://example.test/new', '/new?source=old', '/new#section', ''])('rejects invalid target %s', (redirectTo) => {
    expect(parseContentPageRedirect({ redirectTo }, '/old-page').status).toBe('invalid')
  })

  it('creates metadata without route-access state', () => {
    expect(createContentPageRedirectMeta('/new-page')).toEqual({ redirectTo: '/new-page' })
  })
})
