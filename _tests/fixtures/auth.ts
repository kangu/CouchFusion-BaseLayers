import type { CouchTestHarness, TestUserCredentials } from '../utils/couchdb'

export interface AuthUserSeedOptions {
  username?: string
  password?: string
  roles?: string[]
  payload?: Record<string, any>
  authenticate?: boolean
}

const uniqueRoles = (...lists: Array<string[] | undefined>): string[] => {
  const result = new Set<string>()
  for (const list of lists) {
    if (!Array.isArray(list)) {
      continue
    }
    for (const role of list) {
      if (role) {
        result.add(role)
      }
    }
  }
  return Array.from(result)
}

export const seedAdminUser = (
  harness: CouchTestHarness,
  options: AuthUserSeedOptions = {}
): Promise<TestUserCredentials> => {
  const roles = uniqueRoles(options.roles, ['admin'])
  return harness.createUser({
    ...options,
    roles,
    authenticate: options.authenticate ?? true,
  })
}

export const seedAuthorUser = (
  harness: CouchTestHarness,
  options: AuthUserSeedOptions = {}
): Promise<TestUserCredentials> => {
  const roles = uniqueRoles(options.roles, ['auth'])
  return harness.createUser({
    ...options,
    roles,
    authenticate: options.authenticate ?? true,
  })
}

export const seedUserWithRoles = (
  harness: CouchTestHarness,
  roles: string[],
  options: AuthUserSeedOptions = {}
): Promise<TestUserCredentials> => {
  const combinedRoles = uniqueRoles(options.roles, roles)
  return harness.createUser({
    ...options,
    roles: combinedRoles,
    authenticate: options.authenticate ?? true,
  })
}
