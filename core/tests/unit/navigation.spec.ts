import { describe, expect, it } from 'vitest'
import {
  buildAdminNavigation,
  safeRedirect,
  isNavigationActive,
} from '../../src/features/admin/app/utils/navigation'
describe('admin navigation', () => {
  it('filters restricted items before deduplicating and preserves input', () => {
    const input = [
      {
        id: 'a',
        title: 'Work',
        items: [
          { label: 'Secret', route: '/admin/x', requiresRoles: ['owner'] },
          { label: 'Allowed', route: '/admin/x' },
          { label: 'External', route: '//evil.test' },
        ],
      },
    ]
    expect(
      buildAdminNavigation(input, () => false)[0]?.items.map((i) => i.label),
    ).toEqual(['Allowed'])
    expect(input[0].items).toHaveLength(3)
  })
  it('drops forbidden and empty sections', () => {
    expect(
      buildAdminNavigation(
        [
          {
            id: 'a',
            title: 'Hidden',
            requiresRoles: ['owner'],
            items: [{ label: 'A', route: '/admin' }],
          },
        ],
        () => false,
      ),
    ).toEqual([])
  })
  it('rejects external and encoded redirects', () => {
    for (const value of [
      '//evil.test',
      'https://evil.test',
      '/%2f%2fevil.test',
      '/\\evil.test',
      '/%5cevil.test',
      '/admin\n',
    ])
      expect(safeRedirect(value, '/admin')).toBe('/admin')
    expect(safeRedirect('/admin/users?q=1', '/admin')).toBe('/admin/users?q=1')
  })
  it('matches route boundaries', () => {
    expect(isNavigationActive('/admin', '/admin/users')).toBe(false)
    expect(isNavigationActive('/admin/users', '/admin/users/1')).toBe(true)
    expect(isNavigationActive('/admin/users', '/admin/users-extra')).toBe(false)
  })
})
