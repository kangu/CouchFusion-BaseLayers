import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { getAllDocs, putDocument } from '#database/utils/couchdb'
import { contentHarness } from '../../_tests/setup/content'
import { buildContentPageDocument, seedContentPages } from '../../_tests/fixtures/content'

/**
 * End-to-end check/apply of LLM-request page operations against the CouchDB test
 * harness with the real save / rename / publication helpers (no helper mocks).
 */

const i18n = { defaultLocale: 'en', locales: ['en', 'ro'] }
const runtimeConfig: any = { dbLoginPrefix: '', content: { i18n }, public: { content: { i18n } } }
vi.mock('#imports', () => ({ useRuntimeConfig: () => runtimeConfig, useAppConfig: () => ({}) }))
;(globalThis as any).useRuntimeConfig = () => runtimeConfig

let manifestDir = ''
beforeAll(async () => {
  manifestDir = await mkdtemp(join(tmpdir(), 'cf-control-pages-db-'))
  const manifest = join(manifestDir, 'component-definitions.json')
  await writeFile(manifest, JSON.stringify({ version: 1, components: [{ id: 'hero-banner' }, { id: 'pricing-table' }] }))
  runtimeConfig.content.controlPlaneRegistryManifests = [manifest]
})
afterAll(async () => {
  await rm(manifestDir, { recursive: true, force: true })
})

beforeEach(async () => {
  await contentHarness.teardown()
  const context = await contentHarness.setup()
  runtimeConfig.dbLoginPrefix = context.loginPrefix
})

const database = () => `${runtimeConfig.dbLoginPrefix}-content`
const readAll = async () => {
  const rows = (await getAllDocs(database(), { include_docs: true }))?.rows ?? []
  return new Map(rows.filter((row: any) => row.doc).map((row: any) => [row.doc._id, row.doc]))
}

const seed = async () => {
  await seedContentPages(contentHarness, [
    { path: '/about', title: 'About', body: [['hero-banner', { title: 'Hi' }]] },
    { path: '/pricing', title: 'Pricing', body: [['pricing-table', { plans: 3 }]] },
    { path: '/old', title: 'Old' },
    { path: '/draft', title: 'Draft', publicationState: 'draft' },
  ])
  const ro = buildContentPageDocument({ path: '/about', title: 'Despre', body: [['hero-banner', { title: 'Salut' }]] })
  await putDocument(database(), {
    ...ro,
    _id: 'page-/about::ro',
    path: '/ro/about',
    meta: { contentI18n: { locale: 'ro', masterId: 'page-/about', basePath: '/about' } },
  })
}

describe('control page operations (CouchDB)', () => {
  it('lists pages and documents from the database', async () => {
    await seed()
    const { listControlPages, getControlPageDocuments } = await import('../server/utils/control-page-operations')
    const list = await listControlPages()
    expect(list.pages.map((page) => [page.path, page.locales, page.publicationState])).toEqual([
      ['/about', ['en', 'ro'], 'published'],
      ['/draft', ['en'], 'draft'],
      ['/old', ['en'], 'published'],
      ['/pricing', ['en'], 'published'],
    ])
    const documents = await getControlPageDocuments({ paths: ['/about'], all: false })
    expect(documents.pages[0].documents.map((doc) => [doc.id, doc.title])).toEqual([
      ['page-/about', 'About'],
      ['page-/about::ro', 'Despre'],
    ])
  })

  it('applies update, move, copyContent and publication with the real helpers', async () => {
    await seed()
    const { applyPageOperations, getControlPageDocuments } = await import('../server/utils/control-page-operations')
    const before = await getControlPageDocuments({ paths: [], all: true })
    const baseRevs = Object.fromEntries(before.pages.flatMap((page) => page.documents.map((doc) => [doc.id, doc.rev as string])))

    const result = await applyPageOperations({
      operations: [
        { op: 'page.update', path: '/about', title: 'About us', seo: { description: 'Who we are' } },
        { op: 'page.update', path: '/about', locale: 'ro', title: 'Despre noi' },
        { op: 'page.move', from: '/old', to: '/new', keepRedirect: true },
        { op: 'page.copyContent', from: '/pricing', to: '/about' },
        { op: 'page.publication', path: '/draft', state: 'published' },
      ],
      baseRevs,
    })

    expect(result.status).toBe(200)
    const docs = await readAll()
    const about = docs.get('page-/about')!
    expect(about).toMatchObject({ title: 'About us', seo: { description: 'Who we are' }, body: { value: [['pricing-table', { plans: 3 }]] } })
    expect(docs.get('page-/about::ro')).toMatchObject({ title: 'Despre noi', body: { value: [['pricing-table', { plans: 3 }]] } })
    expect(docs.get('page-/new')).toMatchObject({ title: 'Old', path: '/new' })
    expect(docs.get('page-/old')).toMatchObject({ meta: { redirectTo: '/new' } })
    expect(docs.get('page-/draft')).toMatchObject({ publicationState: 'published' })

    const applied = (result.body as any).applied
    expect(applied[0].documents).toEqual([{ id: 'page-/about', rev: expect.any(String) }])
    expect(applied[2].documents.map((doc: any) => doc.id).sort()).toEqual(['page-/new', 'page-/old'])
    expect(applied[3].documents.map((doc: any) => doc.id)).toEqual(['page-/about', 'page-/about::ro'])
    expect(applied[3].documents[0].rev).toBe(about._rev)
  })

  it('creates a draft page like the builder (history saved) and updates/publishes it later in the proposal', async () => {
    await seed()
    const { applyPageOperations, checkPageOperations } = await import('../server/utils/control-page-operations')
    const operations = [
      { op: 'page.create', path: '/new-page', title: 'New page', seo: { description: 'Fresh' }, body: { type: 'minimal', value: [['hero-banner', { title: 'New' }]] } },
      { op: 'page.update', path: '/new-page', locale: 'ro', title: 'Pagina noua' },
    ]
    expect((await checkPageOperations({ operations, baseRevs: {} })).ok).toBe(true)

    const result = await applyPageOperations({ operations, baseRevs: {} })
    expect(result.status).toBe(200)
    const docs = await readAll()
    const created = docs.get('page-/new-page')!
    expect(created).toMatchObject({
      type: 'page',
      path: '/new-page',
      title: 'New page',
      publicationState: 'draft',
      seo: { title: 'New page', description: 'Fresh', image: null },
      layout: { spacing: 'none' },
      body: { type: 'minimal', value: [['hero-banner', { title: 'New' }]] },
      meta: { contentI18n: expect.objectContaining({ locale: 'en', basePath: '/new-page' }) },
    })
    expect(docs.get('page-/new-page::ro')).toMatchObject({ title: 'Pagina noua', path: '/ro/new-page' })
    expect((result.body as any).applied[0]).toEqual({ index: 0, path: '/new-page', documents: [{ id: 'page-/new-page', rev: created._rev }] })

    const { fetchPageHistory } = await import('../server/utils/page-history')
    expect((await fetchPageHistory('/new-page', 'en')).map((entry) => entry.title)).toEqual(['New page'])

    // The same proposal again: the page now exists, so check refuses and nothing is written.
    const snapshot = Array.from((await readAll()).entries()).map(([id, doc]) => [id, doc._rev])
    const again = await applyPageOperations({ operations: operations.slice(0, 1), baseRevs: {} })
    expect(again).toEqual({ status: 409, body: { ok: false, problems: [{ index: 0, message: 'Page /new-page already exists' }] } })
    expect(Array.from((await readAll()).entries()).map(([id, doc]) => [id, doc._rev])).toEqual(snapshot)
  })

  it('refuses with 409 and writes nothing when a document changed since the request', async () => {
    await seed()
    const { applyPageOperations, getControlPageDocuments } = await import('../server/utils/control-page-operations')
    const before = await getControlPageDocuments({ paths: ['/about'], all: false })
    const baseRevs = { 'page-/about': before.pages[0].documents[0].rev as string }
    const current = (await readAll()).get('page-/about')!
    await putDocument(database(), { ...current, title: 'Edited in the builder' })
    const snapshot = await readAll()

    const result = await applyPageOperations({
      operations: [
        { op: 'page.publication', path: '/draft', state: 'published' },
        { op: 'page.update', path: '/about', title: 'About us' },
      ],
      baseRevs,
    })

    expect(result).toEqual({ status: 409, body: { ok: false, problems: [{ index: 1, message: 'Page /about (en) changed since the request ran.' }] } })
    const after = await readAll()
    expect(Array.from(after.entries()).map(([id, doc]) => [id, doc._rev])).toEqual(Array.from(snapshot.entries()).map(([id, doc]) => [id, doc._rev]))
  })
})
