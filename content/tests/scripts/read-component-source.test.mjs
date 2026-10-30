import { describe, expect, test } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readComponentSource } from '../../scripts/read-component-source.mjs'

const generator = fileURLToPath(new URL('../../scripts/generate-component-registry.mjs', import.meta.url))

describe('readComponentSource', () => {
  test('returns source and stats for an existing file', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cf-read-source-'))
    const file = path.join(dir, 'Hero.vue')
    await fs.writeFile(file, '<template><div /></template>')
    const loaded = await readComponentSource(file)
    expect(loaded?.source).toBe('<template><div /></template>')
    expect(loaded?.stats.isFile()).toBe(true)
    await fs.rm(dir, { recursive: true, force: true })
  })

  test('returns null when the file vanished before reading', async () => {
    const missing = path.join(os.tmpdir(), `cf-missing-${process.pid}-${Date.now()}.vue`)
    expect(await readComponentSource(missing)).toBeNull()
  })

  test('returns null when the file vanished between read and stat', async () => {
    const vanished = Object.assign(new Error('gone'), { code: 'ENOENT' })
    const loaded = await readComponentSource('/x/Hero.vue', {
      readFile: async () => 'source',
      stat: async () => { throw vanished },
    })
    expect(loaded).toBeNull()
  })

  test('rethrows other errors', async () => {
    const denied = Object.assign(new Error('denied'), { code: 'EACCES' })
    await expect(
      readComponentSource('/x/Hero.vue', { readFile: async () => { throw denied } }),
    ).rejects.toThrow('denied')
  })

  test('the generator uses it instead of failing the whole run', async () => {
    const source = await fs.readFile(generator, 'utf8')
    expect(source).toContain("from './read-component-source.mjs'")
    expect(source).toContain('await readComponentSource(file)')
  })
})
