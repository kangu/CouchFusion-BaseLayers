import type { FullConfig } from '@playwright/test'
import { createCouchTestHarness, type CouchTestHarness } from '../../utils/couchdb'

const GLOBAL_KEY = '__playwrightCouchHarnesses__'

type HarnessRegistry = Record<string, CouchTestHarness>

const getRegistry = (): HarnessRegistry => {
  const globalObject = globalThis as typeof globalThis & {
    [GLOBAL_KEY]?: HarnessRegistry
  }

  if (!globalObject[GLOBAL_KEY]) {
    globalObject[GLOBAL_KEY] = {}
  }

  return globalObject[GLOBAL_KEY]!
}

const storeHarness = (projectName: string, harness: CouchTestHarness) => {
  const registry = getRegistry()
  registry[projectName] = harness
}

const resolveMetadata = (metadata: unknown): Record<string, any> =>
  metadata && typeof metadata === 'object' ? (metadata as Record<string, any>) : {}

export default async function globalSetup(config: FullConfig) {
  for (const project of config.projects) {
    const metadata = resolveMetadata(project.metadata)

    if (!metadata.requiresCouch) {
      continue
    }

    const namespace =
      typeof metadata.requiresCouch === 'string' ? metadata.requiresCouch : project.name
    const databaseSuffix =
      typeof metadata.databaseSuffix === 'string'
        ? metadata.databaseSuffix
        : 'content'

    const harness = createCouchTestHarness({
      namespace,
      databaseSuffix,
    })

    const context = await harness.setup()

    metadata.loginPrefix = context.loginPrefix
    metadata.databaseName = context.databaseName

    storeHarness(project.name, harness)
  }
}
