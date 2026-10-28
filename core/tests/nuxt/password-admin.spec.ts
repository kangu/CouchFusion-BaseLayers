import { beforeAll, afterAll, it, expect } from 'vitest'
import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import { createServer } from 'node:net'
import { fileURLToPath } from 'node:url'
import { randomBytes } from 'node:crypto'
import { mkdtemp, writeFile, symlink, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  createLocalTestRun,
  readLocalTestConfig,
  localRequest,
  requireOk,
} from '../helpers/local-harness'
const sourceApp = fileURLToPath(
  new URL('../../../../apps/cf-cloud/', import.meta.url),
)
let app: string
let processUnderTest: ChildProcess,
  origin: string,
  run: Awaited<ReturnType<typeof createLocalTestRun>>
let adminName: string, memberName: string, password: string
let errors = ''
beforeAll(async () => {
  app = await mkdtemp(join(tmpdir(), 'core-ssr-'))
  await symlink(
    join(sourceApp, 'node_modules'),
    join(app, 'node_modules'),
    'dir',
  )
  await writeFile(
    join(app, 'package.json'),
    JSON.stringify({ name: 'core-ssr-test', type: 'module', private: true }),
  )
  await writeFile(
    join(app, 'nuxt.config.ts'),
    `export default defineNuxtConfig({extends:[${JSON.stringify(sourceApp)}],devtools:{enabled:false}})`,
  )
  const built = spawnSync(
    process.execPath,
    [join(sourceApp, 'node_modules/nuxt/bin/nuxt.mjs'), 'build', app],
    { encoding: 'utf8', timeout: 60000 },
  )
  if (built.status !== 0)
    throw new Error(
      'cf-cloud build failed: ' +
        built.stdout.slice(-2000) +
        built.stderr.slice(-2000),
    )
  const server = createServer()
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  const port = (server.address() as any).port
  await new Promise<void>((r) => server.close(() => r()))
  origin = `http://127.0.0.1:${port}`
  processUnderTest = spawn(process.execPath, ['.output/server/index.mjs'], {
    cwd: app,
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  processUnderTest.stderr!.on('data', (chunk) => {
    errors += chunk
  })
  const deadline = Date.now() + 10000
  while (true) {
    try {
      const r = await fetch(origin + '/api/couchdb/session')
      if (r.ok) break
      if (Date.now() > deadline) throw new Error('server settings not ready')
    } catch (error) {
      if (Date.now() > deadline)
        throw new Error('Server did not start: ' + errors)
    }
    await new Promise((r) => setTimeout(r, 50))
  }
  const config = await readLocalTestConfig()
  run = await createLocalTestRun(config)
  password = randomBytes(24).toString('hex')
  adminName = `couchdb_test_${run.runId}_admin`
  memberName = `couchdb_test_${run.runId}_member`
  for (const [name, roles] of [
    [adminName, ['admin']],
    [memberName, []],
  ] as const) {
    const id = await run.register({
      kind: 'user',
      id: 'org.couchdb.user:' + name,
    })
    await requireOk(
      await localRequest(config, '/_users/' + encodeURIComponent(id), {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          _id: id,
          name,
          password,
          roles,
          type: 'user',
          testRunMarker: run.marker,
        }),
      }),
    )
  }
}, 60000)
afterAll(async () => {
  processUnderTest?.kill('SIGTERM')
  if (run) await run.cleanup()
  if (app) await rm(app, { recursive: true, force: true })
})
async function login(name: string, pass = password) {
  const session = await (await fetch(origin + '/api/couchdb/session')).json()
  const response = await fetch(origin + '/api/couchdb/login/password', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-couchdb-csrf': session.csrfToken,
      origin,
    },
    body: JSON.stringify({ name, password: pass }),
  })
  const body = await response.json()
  return {
    response,
    body,
    cookie: response.headers.get('set-cookie')?.split(';')[0] ?? '',
  }
}
it('anonymous SSR redirects before rendering protected content', async () => {
  const r = await fetch(origin + '/admin', { redirect: 'manual' })
  expect(r.status).toBe(302)
  expect(r.headers.get('location')).toBe('/login?redirect=/admin')
  expect((await fetch(origin + '/api/couchdb/admin/users')).status).toBe(401)
  expect((await fetch(origin + '/login')).status).toBe(200)
})
it('renders the colour scheme on the server: workspace default, or the person\'s cookie', async () => {
  const plain = await (await fetch(origin + '/login')).text()
  expect(plain).toMatch(/<html[^>]*data-cf-scheme="system"/)
  expect(plain).toContain('aria-label="Colour scheme"')
  const dark = await (
    await fetch(origin + '/login', { headers: { cookie: 'couchdb_color_scheme=dark' } })
  ).text()
  expect(dark).toMatch(/<html[^>]*data-cf-scheme="dark"/)
  const bogus = await (
    await fetch(origin + '/login', { headers: { cookie: 'couchdb_color_scheme=neon' } })
  ).text()
  expect(bogus).toMatch(/<html[^>]*data-cf-scheme="system"/)
})
it('rejects missing CSRF, foreign origins and wrong passwords', async () => {
  expect(
    (
      await fetch(origin + '/api/couchdb/login/password', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: adminName, password }),
      })
    ).status,
  ).toBe(403)
  const session = await (await fetch(origin + '/api/couchdb/session')).json()
  expect(
    (
      await fetch(origin + '/api/couchdb/login/password', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: 'https://foreign.test',
          'x-couchdb-csrf': session.csrfToken,
        },
        body: JSON.stringify({ name: adminName, password }),
      })
    ).status,
  ).toBe(403)
  expect((await login(adminName, 'wrong-password')).response.status).toBe(401)
})
it('password login produces SSR identity, protected API access and request-isolated state', async () => {
  const a = await login(adminName)
  expect(a.response.status).toBe(200)
  expect(a.body.user).toEqual({ name: adminName, roles: ['admin'] })
  expect(a.cookie).toMatch(/^AuthSession=/)
  expect(a.response.headers.get('set-cookie')).toMatch(/HttpOnly/i)
  const [admin, anonymous, member] = await Promise.all([
    fetch(origin + '/admin', { headers: { cookie: a.cookie } }),
    fetch(origin + '/admin', { redirect: 'manual' }),
    login(memberName),
  ])
  const html = await admin.text()
  expect(admin.status).toBe(200)
  expect(html).toContain('data-testid="admin-shell"')
  expect(html).toContain(adminName)
  expect(anonymous.status).toBe(302)
  expect(
    (await fetch(origin + '/admin', { headers: { cookie: member.cookie } }))
      .status,
  ).toBe(403)
  // A signed-in non-admin is not bounced from the login page into a 403.
  const memberLogin = await fetch(origin + '/login', {
    headers: { cookie: member.cookie },
    redirect: 'manual',
  })
  expect(memberLogin.status).toBe(200)
  const memberLoginHtml = await memberLogin.text()
  expect(memberLoginHtml).toContain('data-testid="login-no-access"')
  expect(memberLoginHtml).toContain('data-testid="login-switch-account"')
  expect(memberLoginHtml).not.toContain('data-testid="login-submit"')
  const adminLogin = await fetch(origin + '/login', {
    headers: { cookie: a.cookie },
    redirect: 'manual',
  })
  expect(adminLogin.status).toBe(302)
  expect(adminLogin.headers.get('location')).toBe('/admin')
  expect(
    (
      await fetch(origin + '/api/couchdb/admin/users', {
        headers: { cookie: a.cookie },
      })
    ).status,
  ).toBe(200)
  expect(
    (
      await fetch(origin + '/api/couchdb/admin/users', {
        headers: { cookie: member.cookie },
      })
    ).status,
  ).toBe(403)
  expect(html).not.toContain(process.env.COUCHDB_ADMIN_AUTH!)
  const out = await fetch(origin + '/api/couchdb/session', {
    method: 'DELETE',
    headers: { cookie: a.cookie, 'x-couchdb-csrf': a.body.csrfToken, origin },
  })
  expect(out.status).toBe(200)
  const loggedOut = await out.json()
  expect(loggedOut.user).toBeNull()
  expect(out.headers.get('set-cookie')).toMatch(/Max-Age=0/i)
  const again = await fetch(origin + '/api/couchdb/login/password', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-couchdb-csrf': loggedOut.csrfToken,
      origin,
    },
    body: JSON.stringify({ name: adminName, password }),
  })
  expect(again.status).toBe(200)
  expect((await fetch(origin + '/admin', { redirect: 'manual' })).status).toBe(
    302,
  )
})
it('does not expose disabled provider, Data Sync or live routes', async () => {
  for (const path of [
    '/api/couchdb/login/email/request',
    '/api/couchdb/login/nostr/challenge',
    '/api/couchdb/admin/datasync/remote-dbs',
    '/api/couchdb/live-users',
  ])
    expect(
      (
        await fetch(origin + path, {
          method: path.includes('live-users') ? 'GET' : 'POST',
          headers: { accept: 'application/json' },
        })
      ).status,
    ).toBe(404)
})
