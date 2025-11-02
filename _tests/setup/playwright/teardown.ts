import type { FullConfig } from '@playwright/test'
import type { CouchTestHarness } from '../../utils/couchdb'

const GLOBAL_KEY = '__playwrightCouchHarnesses__'

const getRegistry = (): Record<string, CouchTestHarness> | null => {
  const globalObject = globalThis as typeof globalThis & {
    [GLOBAL_KEY]?: Record<string, CouchTestHarness>
  }

  return globalObject[GLOBAL_KEY] || null
}

export default async function globalTeardown(_config: FullConfig) {
  const registry = getRegistry()

  if (!registry) {
    return
  }

  const entries = Object.entries(registry)

  await Promise.all(
    entries.map(async ([projectName, harness]) => {
      try {
        await harness.teardown()
      } catch (error) {
        console.warn(`[playwright][${projectName}] couch harness teardown failed`, error)
      }
    })
  )

  entries.forEach(([projectName]) => {
    delete registry[projectName]
  })
}
