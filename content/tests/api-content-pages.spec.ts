import { beforeEach, describe, expect, it, vi } from 'vitest'
import { contentHarness } from '../../_tests/setup/content'
import { buildContentPageDocument, seedContentPages } from '../../_tests/fixtures/content'
import { seedAdminUser, seedUserWithRoles } from '../../_tests/fixtures/auth'
import type { CouchTestHarness } from '../../_tests/utils/couchdb'
import { createEvent } from 'h3'
import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import { getAllDocs, putDocument } from '#database/utils/couchdb'

const runtimeConfig = {
  dbLoginPrefix: '',
  public: {
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

// Provide global accessors for utilities that reference Nuxt auto-imports without explicit imports
;(globalThis as any).useRuntimeConfig = () => runtimeConfig
;(globalThis as any).useAppConfig = () => appConfig

const resetHarness = async (harness: CouchTestHarness) => {
  await harness.teardown()
  const context = await harness.setup()
  runtimeConfig.dbLoginPrefix = context.loginPrefix
}

interface CreateEventOptions {
  method?: string
  path?: string
  query?: Record<string, any>
  body?: any
  headers?: Record<string, string>
}

const createMockEvent = (options: CreateEventOptions = {}) => {
  const method = options.method || 'GET'
  const path = options.path || '/api/content/pages'
  const url = new URL(`http://localhost${path}`)
  const query = options.query || {}

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) {
      url.searchParams.set(key, String(value))
    }
  }

  const headers = Object.fromEntries(Object.entries(options.headers || {}).map(([key, value]) => [key.toLowerCase(), value]))

  const socket = new Socket()
  const req = new IncomingMessage(socket)
  req.method = method
  req.url = `${url.pathname}${url.search}`
  req.headers = headers

  if (options.body !== undefined) {
    if (!req.headers['content-type']) {
      req.headers['content-type'] = 'application/json'
    }
    req.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body)
  }

  const res = new ServerResponse(req)
  res.on('finish', () => socket.destroy())
  res.on('close', () => socket.destroy())
  const event = createEvent(req, res)
  event.context = {}
  return event
}

describe('content pages API handlers', () => {
  beforeEach(async () => {
    await resetHarness(contentHarness)
  })

  it('lists all pages', async () => {
    await seedContentPages(contentHarness, [
      { path: '/about', title: 'About Us' },
      { path: '/contact', title: 'Contact' },
    ])

    const handler = (await import('../server/api/content/pages.get')).default
    const event = createMockEvent()

    const response = await handler(event)

    expect(response.success).toBe(true)
    expect(response.pages).toHaveLength(2)
    const paths = response.pages.map((page: any) => page.path).sort()
    expect(paths).toEqual(['/about', '/contact'])
  })

  it('fetches a page by path', async () => {
    await seedContentPages(contentHarness, { path: '/welcome', title: 'Welcome' })

    const handler = (await import('../server/api/content/pages.get')).default
    const event = createMockEvent({
      query: { path: '/welcome' },
    })

    const response = await handler(event)

    expect(response.success).toBe(true)
    expect(response.page.path).toBe('/welcome')
    expect(response.page.title).toBe('Welcome')
  })

  it('inherits route access metadata from the master page for localized reads', async () => {
    const i18n = {
      defaultLocale: 'en',
      locales: ['en', 'ro'],
    }
    ;(runtimeConfig as any).content = { i18n }
    runtimeConfig.public.content = { i18n }
    appConfig.content = { i18n }

    try {
      const master = buildContentPageDocument({
        path: '/gated',
        title: 'Gated',
        meta: {
          routeAccess: {
            mode: 'entry-session',
            allowedFrom: ['/landing'],
            redirectTo: '/landing',
          },
        },
      })
      master.meta = {
        ...master.meta,
        contentI18n: {
          version: 1,
          masterId: master._id,
          locale: 'en',
          basePath: '/gated',
          defaultLocale: 'en',
          fixedBodyPaths: [],
          updatedAtByLocale: { en: master.updatedAt, ro: master.updatedAt },
        },
      }
      const ro = {
        ...buildContentPageDocument({
          path: '/ro/gated',
          title: 'Gated RO',
          meta: {},
        }),
        _id: `${master._id}::ro`,
        meta: {
          contentI18n: {
            version: 1,
            masterId: master._id,
            locale: 'ro',
            basePath: '/gated',
            defaultLocale: 'en',
            fixedBodyPaths: [],
            updatedAtByLocale: { en: master.updatedAt, ro: master.updatedAt },
          },
        },
      }
      await contentHarness.seedDocuments([master, ro])

      const handler = (await import('../server/api/content/pages.get')).default
      const response = await handler(createMockEvent({
        query: { path: '/ro/gated' },
      }))

      expect(response.page.doc.meta.routeAccess).toEqual(master.meta.routeAccess)
      expect(response.page.meta.routeAccess).toEqual(master.meta.routeAccess)
    } finally {
      delete (runtimeConfig as any).content
      runtimeConfig.public.content = {}
      appConfig.content = {}
    }
  })

  it('normalizes legacy pages without publication state as published', async () => {
    await seedContentPages(contentHarness, { path: '/legacy-public', title: 'Legacy Public' })

    const handler = (await import('../server/api/content/pages.get')).default
    const event = createMockEvent({
      query: { path: '/legacy-public' },
    })

    const response = await handler(event)

    expect(response.success).toBe(true)
    expect(response.page.publicationState).toBe('published')
    expect(response.page.doc.publicationState).toBe('published')
  })

  it('returns 404 for anonymous draft page fetches', async () => {
    await seedContentPages(contentHarness, {
      path: '/draft-preview',
      title: 'Draft Preview',
      publicationState: 'draft',
    })

    const handler = (await import('../server/api/content/pages.get')).default
    const event = createMockEvent({
      query: { path: '/draft-preview' },
    })

    await expect(handler(event)).rejects.toMatchObject({
      statusCode: 404,
      statusMessage: 'Page not found',
    })
  })

  it('allows admins to fetch draft pages', async () => {
    await seedContentPages(contentHarness, {
      path: '/admin-draft',
      title: 'Admin Draft',
      publicationState: 'draft',
    })
    const admin = await seedAdminUser(contentHarness)
    const cookieHeader = admin.setCookie?.split(';')[0] ?? ''

    const handler = (await import('../server/api/content/pages.get')).default
    const event = createMockEvent({
      query: { path: '/admin-draft' },
      headers: { cookie: cookieHeader },
    })

    const response = await handler(event)

    expect(response.success).toBe(true)
    expect(response.page.path).toBe('/admin-draft')
    expect(response.page.publicationState).toBe('draft')
  })

  it('allows editors to fetch draft pages', async () => {
    await seedContentPages(contentHarness, {
      path: '/editor-draft',
      title: 'Editor Draft',
      publicationState: 'draft',
    })
    const editor = await seedUserWithRoles(contentHarness, ['editor'])
    const cookieHeader = editor.setCookie?.split(';')[0] ?? ''

    const handler = (await import('../server/api/content/pages.get')).default
    const event = createMockEvent({
      query: { path: '/editor-draft' },
      headers: { cookie: cookieHeader },
    })

    const response = await handler(event)

    expect(response.success).toBe(true)
    expect(response.page.path).toBe('/editor-draft')
    expect(response.page.publicationState).toBe('draft')
  })

  it('exposes normalized publication state in the page index', async () => {
    await seedContentPages(contentHarness, [
      { path: '/published-index', title: 'Published Index' },
      { path: '/draft-index', title: 'Draft Index', publicationState: 'draft' },
    ])
    const admin = await seedAdminUser(contentHarness)
    const cookieHeader = admin.setCookie?.split(';')[0] ?? ''

    const handler = (await import('../server/api/content/pages.get')).default
    const event = createMockEvent({
      headers: { cookie: cookieHeader },
    })

    const response = await handler(event)

    expect(response.success).toBe(true)
    expect(response.pages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: '/published-index', publicationState: 'published' }),
        expect.objectContaining({ path: '/draft-index', publicationState: 'draft' }),
      ]),
    )
  })

  it('rejects invalid publication state updates', async () => {
    await seedContentPages(contentHarness, { path: '/invalid-state', title: 'Invalid State' })
    const admin = await seedAdminUser(contentHarness)
    const cookieHeader = admin.setCookie?.split(';')[0] ?? ''

    const handler = (await import('../server/api/content/pages/publication-state.patch')).default
    const event = createMockEvent({
      method: 'PATCH',
      path: '/api/content/pages/publication-state',
      body: {
        path: '/invalid-state',
        publicationState: 'archived',
      },
      headers: { cookie: cookieHeader },
    })

    await expect(handler(event)).rejects.toMatchObject({
      statusCode: 400,
      statusMessage: 'Invalid publication state',
    })
  })

  it('updates publication state for a page as an editor', async () => {
    await seedContentPages(contentHarness, {
      path: '/editor-publish',
      title: 'Editor Publish',
      publicationState: 'draft',
    })
    const editor = await seedUserWithRoles(contentHarness, ['editor'])
    const cookieHeader = editor.setCookie?.split(';')[0] ?? ''

    const handler = (await import('../server/api/content/pages/publication-state.patch')).default
    const event = createMockEvent({
      method: 'PATCH',
      path: '/api/content/pages/publication-state',
      body: {
        path: '/editor-publish',
        publicationState: 'published',
      },
      headers: { cookie: cookieHeader },
    })

    const response = await handler(event)

    expect(response.success).toBe(true)
    expect(response.page.path).toBe('/editor-publish')
    expect(response.page.publicationState).toBe('published')
    expect(response.page.doc.publicationState).toBe('published')
  })

  it('updates only the master document for localized publication state changes', async () => {
    const master = buildContentPageDocument({
      path: '/localized-state',
      title: 'Localized State',
      publicationState: 'published',
    })
    const localeDocument = {
      ...buildContentPageDocument({
        path: '/ro/localized-state',
        title: 'Localized State RO',
        publicationState: 'published',
      }),
      _id: `${master._id}::ro`,
      meta: {
        contentI18n: {
          version: 1,
          masterId: master._id,
          locale: 'ro',
          basePath: '/localized-state',
          defaultLocale: 'en',
          fixedBodyPaths: [],
          updatedAtByLocale: {
            en: master.updatedAt,
            ro: master.updatedAt,
          },
        },
      },
    }
    await contentHarness.seedDocuments([master, localeDocument])
    const context = contentHarness.getContext()
    const beforeResponse = await getAllDocs(context.databaseName, {
      keys: [localeDocument._id],
      include_docs: true,
    })
    const localeBefore = Array.isArray(beforeResponse.rows) ? beforeResponse.rows[0]?.doc : null
    const admin = await seedAdminUser(contentHarness)
    const cookieHeader = admin.setCookie?.split(';')[0] ?? ''

    const handler = (await import('../server/api/content/pages/publication-state.patch')).default
    const event = createMockEvent({
      method: 'PATCH',
      path: '/api/content/pages/publication-state',
      body: {
        path: '/localized-state',
        publicationState: 'draft',
      },
      headers: { cookie: cookieHeader },
    })

    const response = await handler(event)

    expect(response.success).toBe(true)
    expect(response.page.path).toBe('/localized-state')
    expect(response.page.publicationState).toBe('draft')

    const docsResponse = await getAllDocs(context.databaseName, {
      keys: [master._id, localeDocument._id],
      include_docs: true,
    })
    const rows = Array.isArray(docsResponse.rows) ? docsResponse.rows : []
    const masterAfter = rows.find((row: any) => row.id === master._id)?.doc
    const localeAfter = rows.find((row: any) => row.id === localeDocument._id)?.doc

    expect(masterAfter?.publicationState).toBe('draft')
    expect(localeAfter?.publicationState).toBe('published')
    expect(localeAfter?._rev).toBe(localeBefore?._rev)
  })

  it('fetches the root page from a legacy page-/ document id', async () => {
    const context = contentHarness.getContext()
    await putDocument(context.databaseName, {
      _id: 'page-/',
      title: 'Legacy Home',
      layout: { spacing: 'none' },
      body: { type: 'minimal', value: [] },
      path: '/',
      seo: { title: 'Legacy Home', description: 'Legacy root page' },
      stem: 'index',
      meta: {},
      extension: 'md',
      navigation: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      type: 'page',
    })

    const handler = (await import('../server/api/content/pages.get')).default
    const event = createMockEvent({
      query: { path: '/' },
    })

    const response = await handler(event)

    expect(response.success).toBe(true)
    expect(response.page.path).toBe('/')
    expect(response.page.title).toBe('Legacy Home')
    expect(response.page.id).toBe('page-/')
  })

  it('updates the root page using the existing legacy page-/ document id', async () => {
    const context = contentHarness.getContext()
    await putDocument(context.databaseName, {
      _id: 'page-/',
      title: 'Legacy Home',
      layout: { spacing: 'none' },
      body: { type: 'minimal', value: [] },
      path: '/',
      seo: { title: 'Legacy Home', description: 'Legacy root page' },
      stem: 'index',
      meta: {},
      extension: 'md',
      navigation: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      type: 'page',
    })

    const admin = await seedAdminUser(contentHarness)
    const cookieHeader = admin.setCookie?.split(';')[0] ?? ''

    const handler = (await import('../server/api/content/pages.put')).default
    const event = createMockEvent({
      method: 'PUT',
      body: {
        document: {
          path: '/',
          title: 'Updated Legacy Home',
          layout: { spacing: 'cozy' },
          body: { type: 'minimal', value: [] },
          seo: { title: 'Updated Legacy Home', description: 'Updated root page' },
          meta: {},
          navigation: true,
        },
      },
      headers: {
        cookie: cookieHeader,
      },
    })

    const response = await handler(event)

    expect(response.success).toBe(true)
    expect(response.page._id).toBe('page-/')
    expect(response.page.title).toBe('Updated Legacy Home')
  })

  it('creates a new page when admin authenticated', async () => {
    const admin = await seedAdminUser(contentHarness)
    const cookieHeader = admin.setCookie?.split(';')[0] ?? ''

    const handler = (await import('../server/api/content/pages.post')).default
    const event = createMockEvent({
      method: 'POST',
      body: {
        document: {
          path: '/new-page',
          title: 'New Page',
          layout: { spacing: 'cozy' },
          body: { type: 'minimal', value: [] },
          seo: { title: 'New Page', description: 'Description' },
          meta: {},
          navigation: true,
        },
      },
      headers: {
        cookie: cookieHeader,
      },
    })

    const response = await handler(event)

    expect(response.success).toBe(true)
    expect(response.page.path).toBe('/new-page')
    expect(response.page.title).toBe('New Page')
  })

  it('updates an existing page and stores history', async () => {
    await seedContentPages(contentHarness, { path: '/story', title: 'Original Title' })
    const admin = await seedAdminUser(contentHarness)
    const cookieHeader = admin.setCookie?.split(';')[0] ?? ''

    const handler = (await import('../server/api/content/pages.put')).default
    const event = createMockEvent({
      method: 'PUT',
      body: {
        document: {
          path: '/story',
          title: 'Updated Title',
          layout: { spacing: 'tight' },
          body: { type: 'minimal', value: [] },
          seo: { title: 'Updated Title', description: 'Updated Description' },
          meta: { category: 'news' },
          navigation: true,
        },
      },
      headers: {
        cookie: cookieHeader,
      },
    })

    const response = await handler(event)

    expect(response.success).toBe(true)
    expect(response.page.title).toBe('Updated Title')

    const historyHandler = (await import('../server/api/content/pages/history.get')).default
    const historyEvent = createMockEvent({
      path: '/api/content/pages/history',
      query: { path: '/story' },
      headers: { cookie: cookieHeader },
    })

    const historyResponse = await historyHandler(historyEvent)

    expect(historyResponse.success).toBe(true)
    expect(historyResponse.history[0].id).toMatch(/^_local\/page-/)
    expect(historyResponse.history[0].id).not.toContain('oldpage-')
    expect(historyResponse.history[0].path).toBe('/story')
    expect(historyResponse.history[0].document.title).toBe('Updated Title')

    const allDocs = await getAllDocs(contentHarness.getContext().databaseName, {
      startkey: 'page-/story-',
      endkey: 'page-/story-\ufff0',
    })
    expect(allDocs?.rows ?? []).toHaveLength(0)
  })

  it('keeps the latest five local page history snapshots', async () => {
    await seedContentPages(contentHarness, { path: '/timeline', title: 'Original Title' })
    const admin = await seedAdminUser(contentHarness)
    const cookieHeader = admin.setCookie?.split(';')[0] ?? ''

    const handler = (await import('../server/api/content/pages.put')).default
    const historyHandler = (await import('../server/api/content/pages/history.get')).default

    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      for (let index = 1; index <= 6; index += 1) {
        vi.setSystemTime(new Date(`2026-07-07T10:00:0${index}.000Z`))
        const event = createMockEvent({
          method: 'PUT',
          body: {
            document: {
              path: '/timeline',
              title: `Timeline Version ${index}`,
              layout: { spacing: 'tight' },
              body: { type: 'minimal', value: [] },
              seo: { title: `Timeline Version ${index}`, description: 'Updated Description' },
              meta: { category: 'news' },
              navigation: true,
            },
          },
          headers: {
            cookie: cookieHeader,
          },
        })

        const response = await handler(event)
        expect(response.success).toBe(true)
      }
    } finally {
      vi.useRealTimers()
    }

    const historyEvent = createMockEvent({
      path: '/api/content/pages/history',
      query: { path: '/timeline', limit: 10 },
      headers: { cookie: cookieHeader },
    })

    const historyResponse = await historyHandler(historyEvent)

    expect(historyResponse.success).toBe(true)
    expect(historyResponse.history).toHaveLength(5)
    expect(historyResponse.history.map((entry: any) => entry.document.title)).toEqual([
      'Timeline Version 6',
      'Timeline Version 5',
      'Timeline Version 4',
      'Timeline Version 3',
      'Timeline Version 2',
    ])
  })

  it('deletes a page', async () => {
    await seedContentPages(contentHarness, { path: '/obsolete', title: 'To remove' })
    const admin = await seedAdminUser(contentHarness)
    const cookieHeader = admin.setCookie?.split(';')[0] ?? ''

    const handler = (await import('../server/api/content/pages.delete')).default
    const event = createMockEvent({
      method: 'DELETE',
      query: { path: '/obsolete' },
      headers: {
        cookie: cookieHeader,
      },
    })

    const response = await handler(event)

    expect(response.success).toBe(true)

    const listHandler = (await import('../server/api/content/pages.get')).default
    const listEvent = createMockEvent()

    const listResponse = await listHandler(listEvent)
    const ids = listResponse.pages.map((page: any) => page.path)
    expect(ids).not.toContain('/obsolete')
  })
})
