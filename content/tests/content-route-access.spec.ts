import { describe, expect, it } from 'vitest'
import {
  buildContentRouteAccessCookieName,
  canResolveContentRouteAccessForPath,
  hasContentRouteAccessSessionCookie,
  isContentRouteAccessEditorPreview,
  parseContentRouteAccessPolicy,
  resolveContentRouteAccessAction,
} from '../utils/route-access'

describe('content route access policy', () => {
  it('bypasses route access only for inline editor preview requests', () => {
    expect(isContentRouteAccessEditorPreview({ 'inline-preview': '1' })).toBe(true)
    expect(isContentRouteAccessEditorPreview({ 'inline-preview': '' })).toBe(true)
    expect(isContentRouteAccessEditorPreview({ preview: '1' })).toBe(false)
    expect(isContentRouteAccessEditorPreview(null)).toBe(false)
  })

  it('probes configurable ignored page paths but not reserved or asset paths', () => {
    expect(canResolveContentRouteAccessForPath('/career-compass/start')).toBe(true)
    expect(canResolveContentRouteAccessForPath('/admin/pages')).toBe(false)
    expect(canResolveContentRouteAccessForPath('/assets/report.pdf')).toBe(false)
  })

  it('reads only the exact access cookie from a server cookie header', () => {
    expect(hasContentRouteAccessSessionCookie(
      'theme=dark; cf_content_entry_abc=1; locale=en',
      'cf_content_entry_abc',
    )).toBe(true)
    expect(hasContentRouteAccessSessionCookie(
      'cf_content_entry_abc_extra=1; cf_content_entry_abc=0',
      'cf_content_entry_abc',
    )).toBe(false)
  })

  it('treats missing route access metadata as public', () => {
    expect(parseContentRouteAccessPolicy({}, '/assessment')).toEqual({
      status: 'public',
    })
  })

  it('normalizes and deduplicates allowed source paths', () => {
    expect(parseContentRouteAccessPolicy({
      routeAccess: {
        mode: 'entry-session',
        allowedFrom: ['/landing/', ' /campaign ', '/landing'],
        redirectTo: '/landing/',
      },
    }, '/assessment/')).toEqual({
      status: 'valid',
      policy: {
        mode: 'entry-session',
        allowedFrom: ['/landing', '/campaign'],
        redirectTo: '/landing',
      },
    })
  })

  it.each([
    ['external source', ['https://example.com/landing'], '/landing'],
    ['source query', ['/landing?from=campaign'], '/landing'],
    ['source hash', ['/landing#start'], '/landing'],
    ['empty sources', [], '/landing'],
    ['external redirect', ['/landing'], 'https://example.com/landing'],
    ['redirect outside sources', ['/landing'], '/other'],
    ['target as source', ['/assessment'], '/assessment'],
  ])('rejects %s configuration', (_label, allowedFrom, redirectTo) => {
    const result = parseContentRouteAccessPolicy({
      routeAccess: {
        mode: 'entry-session',
        allowedFrom,
        redirectTo,
      },
    }, '/assessment')

    expect(result.status).toBe('invalid')
  })

  it('grants a session only for navigation from an allowed source', () => {
    const policy = {
      mode: 'entry-session' as const,
      allowedFrom: ['/landing', '/campaign'],
      redirectTo: '/landing',
    }

    expect(resolveContentRouteAccessAction({
      policy,
      fromPath: '/campaign/',
      hasSession: false,
    })).toEqual({ type: 'allow', grantSession: true })

    expect(resolveContentRouteAccessAction({
      policy,
      fromPath: '/unlisted',
      hasSession: false,
    })).toEqual({ type: 'redirect', to: '/landing' })
  })

  it('allows later requests when the browser-session marker exists', () => {
    expect(resolveContentRouteAccessAction({
      policy: {
        mode: 'entry-session',
        allowedFrom: ['/landing'],
        redirectTo: '/landing',
      },
      fromPath: null,
      hasSession: true,
    })).toEqual({ type: 'allow', grantSession: false })
  })

  it('builds a stable target-specific cookie name that changes with policy', () => {
    const basePolicy = {
      mode: 'entry-session' as const,
      allowedFrom: ['/landing'],
      redirectTo: '/landing',
    }
    const first = buildContentRouteAccessCookieName('/assessment', basePolicy)
    const repeated = buildContentRouteAccessCookieName('/assessment/', basePolicy)
    const changed = buildContentRouteAccessCookieName('/assessment', {
      ...basePolicy,
      allowedFrom: ['/campaign'],
      redirectTo: '/campaign',
    })

    expect(first).toBe(repeated)
    expect(first).toMatch(/^cf_content_entry_[a-z0-9]+$/)
    expect(changed).not.toBe(first)
  })
})
