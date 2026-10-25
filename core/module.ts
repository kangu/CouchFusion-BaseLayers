import {
  defineNuxtModule,
  createResolver,
  addTemplate,
  addImports,
  addRouteMiddleware,
  addVitePlugin,
  addServerHandler,
  addServerPlugin,
} from '@nuxt/kit'
import { resolveOptions } from './src/options'
import type { CouchDBModuleOptions, AdminSection } from './src/shared/types'
export default defineNuxtModule<CouchDBModuleOptions>({
  meta: {
    name: '@couchfusion/core',
    configKey: 'couchdb',
    compatibility: { nuxt: '^4.6.2' },
  },
  defaults: {},
  async setup(input, nuxt) {
    const r = createResolver(import.meta.url),
      options = resolveOptions(input),
      f = options.features
    const sections: AdminSection[] = []
    await nuxt.callHook('couchdb:admin:sections' as any, sections)
    options.defaults.admin.sections = [
      ...sections,
      ...options.defaults.admin.sections,
    ]
    if (f.dataSync)
      options.defaults.admin.sections.push({
        id: 'database',
        title: 'Database',
        items: [{ label: 'Data Sync', route: '/admin/datasync' }],
        requiresRoles: options.defaults.admin.roles,
      })
    const template = addTemplate({
      filename: 'couchdb-options.mjs',
      write: true,
      getContents: () => `export default ${JSON.stringify(options)}`,
    })
    nuxt.options.alias['#core'] = r.resolve('./src')
    nuxt.options.alias['#core-options'] = template.dst
    const nitroConfig = nuxt.options.nitro as import('nitropack').NitroConfig
    nitroConfig.alias ??= {}
    nitroConfig.alias['#core'] = r.resolve('./src')
    nitroConfig.alias['#core-options'] = template.dst
    nuxt.options.build.transpile.push(r.resolve('./src'))
    // A client-side import of privileged code is a build error, not a polyfilled secret leak.
    addVitePlugin(
      {
        name: 'core-server-boundary',
        enforce: 'pre',
        resolveId(id) {
          if (
            id.startsWith('#core/server') ||
            id.startsWith(r.resolve('./src/server') + '/')
          )
            throw new Error(
              '[core] Server-only utilities cannot be imported into browser code',
            )
        },
        load(id) {
          if (id.startsWith(r.resolve('./src/server') + '/'))
            throw new Error(
              '[core] Server-only utilities cannot be imported into browser code',
            )
        },
      },
      { client: true, server: false },
    )
    const handler = (route: string, file: string, method?: string) =>
      addServerHandler({
        route,
        handler: r.resolve('./src/features/' + file),
        ...(method ? { method: method as any } : {}),
      })
    const pages: {
      name: string
      path: string
      file: string
      meta?: Record<string, any>
    }[] = []
    if (options.config.enabled || f.auth)
      addServerPlugin(r.resolve('./src/server/bootstrap-plugin.ts'))
    if (f.auth) {
      addImports({
        name: 'useCouchDBAuth',
        from: r.resolve(
          './src/features/auth-client/app/composables/useCouchDBAuth',
        ),
      })
      addRouteMiddleware({
        name: 'couchdb-session',
        path: r.resolve(
          './src/features/auth-client/app/middleware/session.global.ts',
        ),
        global: true,
      })
      handler('/api/couchdb/session', 'auth-api/server/session.get.ts', 'get')
      handler(
        '/api/couchdb/session',
        'auth-api/server/session.delete.ts',
        'delete',
      )
      handler('/api/couchdb/settings', 'auth-api/server/settings.get.ts', 'get')
    }
    if (f.password)
      handler(
        '/api/couchdb/login/password',
        'login-password/server/login.post.ts',
        'post',
      )
    if (f.ui)
      pages.push({
        name: 'couchdb-login',
        path: options.defaults.auth.loginPath,
        file: r.resolve('./src/features/login-ui/app/pages/login.vue'),
      })
    if (f.email) {
      if (!options.emailDeliveryHandler)
        throw new Error(
          '[couchdb] auth.email requires a server emailDeliveryHandler',
        )
      const adapter = r.resolve(
        nuxt.options.rootDir,
        options.emailDeliveryHandler,
      )
      nuxt.options.alias['#core-email-delivery'] = adapter
      nitroConfig.alias['#core-email-delivery'] = adapter
      handler(
        '/api/couchdb/login/email/request',
        'login-email/server/request.post.ts',
        'post',
      )
      handler(
        '/api/couchdb/login/email/verify',
        'login-email/server/verify.post.ts',
        'post',
      )
    }
    if (f.proofOfWork)
      handler(
        '/api/couchdb/proof-of-work/challenge',
        'proof-of-work/server/challenge.post.ts',
        'post',
      )
    if (f.nostr) {
      handler(
        '/api/couchdb/login/nostr/challenge',
        'login-nostr/server/challenge.post.ts',
        'post',
      )
      handler(
        '/api/couchdb/login/nostr/verify',
        'login-nostr/server/verify.post.ts',
        'post',
      )
    }
    if (f.admin) {
      nuxt.hook('app:resolve', (app) => {
        app.layouts['admin-workspace'] ??= {
          name: 'admin-workspace',
          file: r.resolve(
            './src/features/admin/app/layouts/admin-workspace.vue',
          ),
        }
      })
      addImports(
        ['useCouchDBAdminTitle', 'useAdminWorkspaceHeaderTitle'].map(
          (name) => ({
            name,
            from: r.resolve(
              './src/features/admin/app/composables/useCouchDBAdminTitle',
            ),
          }),
        ),
      )
      pages.push({
        name: 'couchdb-admin',
        path: '/admin',
        file: r.resolve('./src/features/admin/app/pages/admin/index.vue'),
        meta: { layout: 'admin-workspace' },
      })
      handler('/api/couchdb/admin/users', 'admin/server/users.get.ts', 'get')
    }
    if (f.dataSync) {
      pages.push({
        name: 'couchdb-datasync',
        path: '/admin/datasync',
        file: r.resolve('./src/features/datasync/app/pages/datasync.vue'),
        meta: { layout: 'admin-workspace' },
      })
      for (const [suffix, file, method] of [
        ['replicate', 'replicate.post.ts', 'post'],
        ['remote-dbs', 'remote-dbs.post.ts', 'post'],
        ['compare-docs', 'compare-docs.post.ts', 'post'],
        ['db-info/:db_name', 'db-info/[db_name].post.ts', 'post'],
        [
          'replication-status/:db_name',
          'replication-status/[db_name].get.ts',
          'get',
        ],
        ['doc/sync-up', 'doc/sync-up.post.ts', 'post'],
        ['doc/sync-down', 'doc/sync-down.post.ts', 'post'],
      ])
        handler(
          '/api/couchdb/admin/datasync/' + suffix,
          'datasync/server/' + file,
          method,
        )
    }
    if (f.liveUsers) {
      handler(
        '/api/couchdb/live-users',
        'live-users/server/events.get.ts',
        'get',
      )
      addServerPlugin(r.resolve('./src/features/live-users/server/plugin.ts'))
    }
    if (pages.length) {
      nuxt.options.pages = true
      nuxt.hook('pages:extend', (existing) => {
        for (const page of pages)
          if (!existing.some((p) => p.path === page.path)) existing.push(page)
      })
    }
  },
})
declare module '@nuxt/schema' {
  interface NuxtConfig {
    couchdb?: CouchDBModuleOptions
  }
  interface NuxtOptions {
    couchdb: CouchDBModuleOptions
  }
}
