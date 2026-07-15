import { describe, expect, test } from 'bun:test'
import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const generator = fileURLToPath(new URL('../../scripts/generate-component-registry.mjs', import.meta.url))
const watcher = fileURLToPath(new URL('../../scripts/watch-component-registry.mjs', import.meta.url))
const watcherModule = fileURLToPath(new URL('../../utils/component-registry-watch.ts', import.meta.url))

describe('canonical component registry generator', () => {
  test('builds records and installs the paired output', async () => {
    const source = await fs.readFile(generator, 'utf8')
    expect(source).toContain("from './registry-output.mjs'")
    expect(source).toContain('createRegistryRecord(definition, file, appRoot)')
    expect(source).toContain('writeRegistryPair({ outputFile, records })')
    expect(source).not.toContain('writeDefinitionsFile')
  })

  test('retains image hints, preview sections, and layer directory extensions', async () => {
    const source = await fs.readFile(generator, 'utf8')
    expect(source).toContain('applyImageFieldUi')
    expect(source).toContain('meta.previewSections')
    expect(source).toContain('extraComponentDirFlags')
    expect(source).toContain('readConfiguredComponentDirs')
    expect(source).toContain('resolveNodeTypes')
  })

  test('keeps normal Nuxt dev rebuilds on the canonical generator path', async () => {
    const [watcherSource, moduleSource] = await Promise.all([
      fs.readFile(watcher, 'utf8'),
      fs.readFile(watcherModule, 'utf8'),
    ])

    expect(moduleSource).toContain('../scripts/watch-component-registry.mjs')
    expect(watcherSource).toContain("'generate-component-registry.mjs'")
    expect(watcherSource).toContain("path.join(repoRoot, 'layers', 'content', 'scripts'")
  })
})
