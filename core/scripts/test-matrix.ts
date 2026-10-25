import {
  mkdtemp,
  writeFile,
  symlink,
  rm,
  readFile,
  readdir,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
const root = fileURLToPath(new URL('../', import.meta.url)),
  cli = join(root, 'node_modules/nuxt/bin/nuxt.mjs')
const profiles = [
  { name: 'database-only', options: {} },
  { name: 'server-only-boundary', options: {}, forbidden: true },
  {
    name: 'password-admin-datasync',
    options: {
      auth: { enabled: true, password: true, ui: true },
      admin: { enabled: true, dataSync: true },
    },
  },
  {
    name: 'optional-providers',
    options: {
      appSlug: 'matrix',
      auth: {
        enabled: true,
        password: true,
        email: true,
        nostr: true,
        ui: true,
        proofOfWork: true,
        liveUsers: true,
        emailDeliveryHandler: './delivery.ts',
      },
      admin: { enabled: true },
    },
  },
] as const
let failed = false
for (const profile of profiles) {
  const dir = await mkdtemp(join(tmpdir(), 'core-matrix-'))
  try {
    await symlink(join(root, 'node_modules'), join(dir, 'node_modules'), 'dir')
    await writeFile(
      join(dir, 'package.json'),
      JSON.stringify({ name: 'core-matrix', private: true, type: 'module' }),
    )
    await writeFile(
      join(dir, 'nuxt.config.ts'),
      `export default defineNuxtConfig({extends:[${JSON.stringify(root)}],compatibilityDate:'2026-10-25',devtools:{enabled:false},couchdb:${JSON.stringify(profile.options)}})`,
    )
    await writeFile(
      join(dir, 'app.vue'),
      'forbidden' in profile
        ? `<script setup>import {getBootstrapConfig} from '#core/server/client';console.log(getBootstrapConfig())</script><template><div>Boundary</div></template>`
        : '<template><NuxtLayout><NuxtPage /></NuxtLayout></template>',
    )
    await writeFile(
      join(dir, 'delivery.ts'),
      'export default async function deliver() { throw new Error("Build-only adapter must not send messages") }',
    )
    const env = { ...process.env }
    delete env.COUCHDB_ADMIN_AUTH
    const started = performance.now(),
      result = spawnSync(process.execPath, [cli, 'build', dir], {
        env,
        encoding: 'utf8',
        timeout: 60000,
        maxBuffer: 4 * 1024 * 1024,
      })
    await writeFile(
      join(root, `.test-runs/matrix-${profile.name}.log`),
      result.stdout + result.stderr,
    ).catch(() => {})
    if ('forbidden' in profile) {
      if (
        result.status === 0 ||
        !(result.stdout + result.stderr).includes('[core] Server-only')
      )
        throw new Error('Server-only boundary did not reject the client import')
      console.log('server-only-boundary: correctly rejected browser import')
      continue
    }
    if (result.status !== 0)
      throw new Error((result.stdout + result.stderr).slice(-3000))
    const output = await readFile(
      join(dir, '.output/server/package.json'),
      'utf8',
    )
    if (
      profile.name === 'database-only' &&
      /nostr-tools|pinia|vueuse|iconify/.test(output)
    )
      throw new Error(
        'Optional runtime dependency leaked into database-only output',
      )
    console.log(
      `${profile.name}: build passed without credentials (${Math.round(performance.now() - started)}ms)`,
    )
  } catch (e) {
    failed = true
    console.error(`${profile.name}: ${String(e)}`)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}
if (failed) process.exitCode = 1
