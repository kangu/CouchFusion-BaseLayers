import { describe, expect, it } from 'vitest'
import {
  canOpen,
  hasAdminAccess,
  isAdminPath,
  loginDestination,
} from '../../src/features/auth-client/app/utils/access'
import type { PublicSettings } from '../../src/features/auth-client/app/utils/types'

function settings(
  overrides: { roles?: string[]; admin?: boolean; redirectPath?: string } = {},
) {
  return {
    features: { admin: overrides.admin ?? true },
    auth: { loginPath: '/login', redirectPath: overrides.redirectPath ?? '/admin' },
    admin: { roles: overrides.roles ?? ['admin'] },
  } as unknown as PublicSettings
}
const admin = { name: 'a', roles: ['admin'] }
const member = { name: 'm', roles: ['member'] }

describe('login access helpers', () => {
  it('detects admin paths with query strings and route boundaries', () => {
    expect(isAdminPath('/admin')).toBe(true)
    expect(isAdminPath('/admin/users?q=1')).toBe(true)
    expect(isAdminPath('/admin?tab=x')).toBe(true)
    expect(isAdminPath('/administrator')).toBe(false)
    expect(isAdminPath('/')).toBe(false)
  })
  it('mirrors server role checks', () => {
    expect(hasAdminAccess(settings(), admin)).toBe(true)
    expect(hasAdminAccess(settings(), member)).toBe(false)
    expect(hasAdminAccess(settings(), null)).toBe(false)
    expect(hasAdminAccess(settings({ roles: [] }), member)).toBe(true)
    expect(hasAdminAccess(settings({ admin: false }), admin)).toBe(false)
  })
  it('only blocks admin destinations the user cannot open', () => {
    expect(canOpen('/admin', settings(), member)).toBe(false)
    expect(canOpen('/admin', settings(), admin)).toBe(true)
    expect(canOpen('/account', settings(), member)).toBe(true)
  })
  it('chooses a safe destination that is never the login page', () => {
    expect(loginDestination(undefined, settings())).toBe('/admin')
    expect(loginDestination('/admin/users', settings())).toBe('/admin/users')
    expect(loginDestination('//evil.test', settings())).toBe('/admin')
    expect(loginDestination('/login?x=1', settings())).toBe('/admin')
    expect(loginDestination(undefined, settings({ redirectPath: '/account' }))).toBe(
      '/account',
    )
  })
})
