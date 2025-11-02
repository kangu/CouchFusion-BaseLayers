import { beforeEach, describe, expect, it, vi } from 'vitest'
import { contentHarness } from '../../_tests/setup/content'
import { seedContentPages } from '../../_tests/fixtures/content'
import { seedAdminUser } from '../../_tests/fixtures/auth'
import type { CouchTestHarness } from '../../_tests/utils/couchdb'
import { createEvent } from 'h3'
import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'

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

  it('creates a new page when admin authenticated', async () => {
    const admin = await seedAdminUser(contentHarness, { username: 'admin-user' })
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
    const admin = await seedAdminUser(contentHarness, { username: 'editor-user' })
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
    expect(historyResponse.history[0].path).toBe('/story')
    expect(historyResponse.history[0].document.title).toBe('Updated Title')
  })

  it('deletes a page', async () => {
    await seedContentPages(contentHarness, { path: '/obsolete', title: 'To remove' })
    const admin = await seedAdminUser(contentHarness, { username: 'deleter-user' })
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
