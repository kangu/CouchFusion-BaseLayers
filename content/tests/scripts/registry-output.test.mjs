import { afterEach, describe, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { createRegistryRecord, renderRegistryOutputs, writeRegistryPair } from '../../scripts/registry-output.mjs'

const temporaryRoots = []

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })))
})

describe('createRegistryRecord', () => {
  test.each([
    ['Nuxt 3', 'components/content/Hero.vue'],
    ['Nuxt 4', 'app/components/content/Hero.vue'],
    ['nested', 'app/components/content/marketing/Hero.vue'],
  ])('keeps a %s source relative to the site root', (_name, relativeSource) => {
    const appRoot = path.join(path.sep, 'workspace', 'apps', 'shop')
    const definition = {
      id: 'hero',
      label: 'Hero',
      description: 'Lead block',
      props: [{ key: 'title' }],
      allowChildren: true,
    }

    const record = createRegistryRecord(definition, path.join(appRoot, relativeSource), appRoot)

    expect(record).toEqual({
      definition,
      manifest: {
        id: 'hero',
        label: 'Hero',
        description: 'Lead block',
        source: relativeSource,
        propCount: 1,
        allowChildren: true,
      },
    })
  })

  test('rejects a source outside the site root', () => {
    expect(() => createRegistryRecord({ id: 'hero' }, '/workspace/apps/outside/Hero.vue', '/workspace/apps/shop'))
      .toThrow('outside the app root')
  })
})

describe('renderRegistryOutputs', () => {
  test('sorts records by ID and links JSON to the exact TypeScript bytes', () => {
    const appRoot = '/workspace/apps/shop'
    const records = [
      createRegistryRecord(
        { id: 'z-card', label: 'Z Card', description: '', props: [] },
        `${appRoot}/components/content/ZCard.vue`,
        appRoot,
      ),
      createRegistryRecord(
        { id: 'a-hero', label: 'A Hero', description: 'Hero', props: [{ key: 'title' }] },
        `${appRoot}/components/content/AHero.vue`,
        appRoot,
      ),
    ]

    const outputs = renderRegistryOutputs(records)
    const manifest = JSON.parse(outputs.manifest.toString('utf8'))

    expect(manifest.version).toBe(1)
    expect(manifest.components.map((component) => component.id)).toEqual(['a-hero', 'z-card'])
    expect(manifest.typescriptSha256).toBe(createHash('sha256').update(outputs.typescript).digest('hex'))
    expect(outputs.typescript.toString('utf8')).toContain("id: 'a-hero'")
    expect(outputs.manifest.toString('utf8').endsWith('\n')).toBe(true)
  })

  test('renders a valid empty registry', () => {
    const outputs = renderRegistryOutputs([])

    expect(JSON.parse(outputs.manifest.toString('utf8')).components).toEqual([])
    expect(outputs.typescript.toString('utf8')).toContain('const definitions: ComponentDefinition[] = []')
  })
})

describe('writeRegistryPair', () => {
  test('syncs both files and installs TypeScript before the JSON commit marker', async () => {
    const root = await fs.mkdtemp(path.join(tmpdir(), 'registry-output-'))
    temporaryRoots.push(root)
    const outputFile = path.join(root, 'app/content-builder/component-definitions.ts')
    const operations = []

    await writeRegistryPair({ outputFile, records: [], fileSystem: recordingFileSystem(operations) })

    expect(operations.filter(([name]) => name === 'sync')).toHaveLength(2)
    expect(operations.filter(([name]) => name === 'rename').map(([, , target]) => path.basename(target))).toEqual([
      'component-definitions.ts',
      'component-definitions.json',
    ])
    expect(await fs.readFile(outputFile, 'utf8')).toContain('ComponentDefinition[] = []')
    expect(JSON.parse(await fs.readFile(outputFile.replace(/\.ts$/, '.json'), 'utf8')).version).toBe(1)
  })

  test.each([1, 2])('cleans remaining temporary files when rename %d fails', async (failedRename) => {
    const root = await fs.mkdtemp(path.join(tmpdir(), 'registry-output-failure-'))
    temporaryRoots.push(root)
    const outputFile = path.join(root, 'content-builder/component-definitions.ts')

    await expect(writeRegistryPair({
      outputFile,
      records: [],
      fileSystem: recordingFileSystem([], failedRename),
    })).rejects.toThrow('forced rename failure')

    const entries = await fs.readdir(path.dirname(outputFile))
    expect(entries.filter((name) => name.endsWith('.tmp'))).toEqual([])
  })
})

function recordingFileSystem(operations, failedRename = 0) {
  let renameCount = 0
  return {
    async mkdir(...args) {
      operations.push(['mkdir', ...args])
      return fs.mkdir(...args)
    },
    async open(...args) {
      operations.push(['open', args[0]])
      const handle = await fs.open(...args)
      return {
        async writeFile(value) {
          operations.push(['writeFile', args[0]])
          return handle.writeFile(value)
        },
        async sync() {
          operations.push(['sync', args[0]])
          return handle.sync()
        },
        async close() {
          operations.push(['close', args[0]])
          return handle.close()
        },
      }
    },
    async rename(source, target) {
      renameCount += 1
      operations.push(['rename', source, target])
      if (renameCount === failedRename) throw new Error('forced rename failure')
      return fs.rename(source, target)
    },
    async unlink(file) {
      operations.push(['unlink', file])
      return fs.unlink(file)
    },
  }
}
