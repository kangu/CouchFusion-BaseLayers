import { describe, expect, it } from 'vitest'
import {
  applyRouteAccessDraft,
  createRouteAccessDraft,
  isRouteAccessEditorReadOnly,
  validateRouteAccessDraft,
} from '../../app/utils/route-access-editor'

describe('route access page-meta editor model', () => {

  it('hydrates a gated policy into editable route lines', () => {
    expect(createRouteAccessDraft({
      routeAccess: {
        mode: 'entry-session',
        allowedFrom: ['/landing', '/campaign'],
        redirectTo: '/landing',
      },
    }, '/assessment')).toEqual({
      mode: 'entry-session',
      allowedFromText: '/landing\n/campaign',
      redirectTo: '/landing',
    })
  })

  it('validates and normalizes an entry-session draft', () => {
    const result = validateRouteAccessDraft({
      mode: 'entry-session',
      allowedFromText: '/landing/\n/campaign\n/landing',
      redirectTo: '/landing/',
    }, '/assessment')

    expect(result).toEqual({
      valid: true,
      errors: [],
      policy: {
        mode: 'entry-session',
        allowedFrom: ['/landing', '/campaign'],
        redirectTo: '/landing',
      },
    })
  })

  it('returns inline validation errors for an invalid gated draft', () => {
    const result = validateRouteAccessDraft({
      mode: 'entry-session',
      allowedFromText: '/assessment\nhttps://example.com/landing',
      redirectTo: '/other',
    }, '/assessment')

    expect(result.valid).toBe(false)
    expect(result.errors).toEqual(expect.arrayContaining([
      expect.stringContaining('internal paths'),
      expect.stringContaining('target page'),
      expect.stringContaining('allowed source'),
    ]))
  })

  it('clears only routeAccess when public mode is applied', () => {
    const result = applyRouteAccessDraft({
      category: 'campaign',
      routeAccess: {
        mode: 'entry-session',
        allowedFrom: ['/landing'],
        redirectTo: '/landing',
      },
    }, '/assessment', {
      mode: 'public',
      allowedFromText: '',
      redirectTo: '',
    })

    expect(result).toEqual({
      valid: true,
      errors: [],
      meta: { category: 'campaign' },
    })
  })

  it('makes route access read-only outside the default locale', () => {
    expect(isRouteAccessEditorReadOnly('en', 'en')).toBe(false)
    expect(isRouteAccessEditorReadOnly('ro', 'en')).toBe(true)
  })
})
