import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createEvent } from 'h3'
import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import { contentHarness } from '../../_tests/setup/content'
import { buildContentPageDocument, seedContentPages } from '../../_tests/fixtures/content'
import type { CouchTestHarness } from '../../_tests/utils/couchdb'

const runtimeConfig = {
  dbLoginPrefix: '',
  public: {
    siteUrl: 'https://example.test',
    content: {},
  },
}

const appConfig = {
  content: {},
}

vi.mock('#imports', () => ({
  useRuntimeConfig: () => runtimeConfig,
  useAppConfig: () => appConfig,
}))

;(globalThis as any).useRuntimeConfig = () => runtimeConfig
;(globalThis as any).useAppConfig = () => appConfig

const resetHarness = async (harness: CouchTestHarness) => {
  await harness.teardown()
  const context = await harness.setup()
  runtimeConfig.dbLoginPrefix = context.loginPrefix
}

const createMockEvent = () => {
  const socket = new Socket()
  const req = new IncomingMessage(socket)
  req.method = 'GET'
  req.url = '/sitemap.xml'
  req.headers = {
    host: 'example.test',
  }

  const res = new ServerResponse(req)
  res.on('finish', () => socket.destroy())
  res.on('close', () => socket.destroy())
  const event = createEvent(req, res)
  event.context = {}
  return event
}

describe('sitemap draft pages', () => {
  beforeEach(async () => {
    await resetHarness(contentHarness)
  })

  it('excludes draft content pages from the sitemap', async () => {
    await seedContentPages(contentHarness, [
      {
        path: '/published-story',
        title: 'Published Story',
        publicationState: 'published',
      },
      {
        path: '/draft-story',
        title: 'Draft Story',
        publicationState: 'draft',
      },
    ])

    const handler = (await import('../server/api/sitemap.xml.get')).default
    const xml = await handler(createMockEvent())

    expect(xml).toContain('https://example.test/published-story')
    expect(xml).not.toContain('https://example.test/draft-story')
  })

  it('excludes localized routes when the page group is draft', async () => {
    const master = buildContentPageDocument({
      path: '/localized-draft',
      title: 'Localized Draft',
      publicationState: 'draft',
    })
    const localized = {
      ...buildContentPageDocument({
        path: '/ro/localized-draft',
        title: 'Localized Draft RO',
        publicationState: 'published',
      }),
      _id: `${master._id}::ro`,
      meta: {
        contentI18n: {
          version: 1,
          masterId: master._id,
          locale: 'ro',
          basePath: '/localized-draft',
          defaultLocale: 'en',
          fixedBodyPaths: [],
          updatedAtByLocale: {
            en: master.updatedAt,
            ro: master.updatedAt,
          },
        },
      },
    }

    await contentHarness.seedDocuments([master, localized])

    const handler = (await import('../server/api/sitemap.xml.get')).default
    const xml = await handler(createMockEvent())

    expect(xml).not.toContain('https://example.test/localized-draft')
    expect(xml).not.toContain('https://example.test/ro/localized-draft')
  })
})
