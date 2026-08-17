import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getAllDocs } from '#database/utils/couchdb'
import { contentHarness } from '../../_tests/setup/content'
import { seedContentPages } from '../../_tests/fixtures/content'

const runtimeConfig = { dbLoginPrefix: '', public: { content: {} } }
vi.mock('#imports', () => ({ useRuntimeConfig: () => runtimeConfig }))
;(globalThis as any).useRuntimeConfig = () => runtimeConfig

beforeEach(async () => {
  await contentHarness.teardown()
  const context = await contentHarness.setup()
  runtimeConfig.dbLoginPrefix = context.loginPrefix
})

describe('content page URL rename', () => {
  it('creates the target before deleting the source by default', async () => {
    await seedContentPages(contentHarness, { path: '/old-page', title: 'Old page', publicationState: 'draft' })
    const { renameContentPageUrl } = await import('../server/utils/content-page-url-rename')

    const result = await renameContentPageUrl({ sourcePath: '/old-page', targetPath: '/new-page', keepRedirect: false })
    const rows = (await getAllDocs(`${runtimeConfig.dbLoginPrefix}-content`, { include_docs: true })).rows
    const documents = rows.map((row: any) => row.doc).filter(Boolean)

    expect(result).toMatchObject({ targetPath: '/new-page', migratedLocales: ['en'], redirectRetained: false })
    expect(documents.find((document: any) => document.path === '/old-page')).toBeUndefined()
    expect(documents.find((document: any) => document.path === '/new-page')).toMatchObject({ publicationState: 'draft', title: 'Old page' })
  })
})
