import { fileURLToPath } from 'node:url'

const extractPageLayout = (page: any): string | null => {
  if (!page || typeof page !== 'object') {
    return null
  }

  const layout = page.meta?.layout
  return typeof layout === 'string' && layout.length > 0 ? layout : null
}

const inferHostAdminLayout = (pages: any[], layerRoot: string): string | null => {
  for (const page of pages) {
    const pagePath = typeof page?.path === 'string' ? page.path : ''
    if (!pagePath.startsWith('/admin')) {
      continue
    }

    const pageFile = typeof page?.file === 'string' ? page.file : ''
    // Ignore pages that come from this layer itself.
    if (pageFile.startsWith(layerRoot)) {
      continue
    }

    const layout = extractPageLayout(page)
    if (layout) {
      return layout
    }
  }

  return null
}

export default function registerDatabaseLayoutModule(_options: any, nuxt: any) {
  const layerRoot = fileURLToPath(new URL('..', import.meta.url))

  nuxt.hook('pages:extend', (pages: any[]) => {
    const layoutFromAppConfig = nuxt.options.appConfig?.adminWorkspace?.layout
    const layoutFromLegacyConfig = nuxt.options.appConfig?.uiNavigation?.adminLayout
    const inferredHostAdminLayout = inferHostAdminLayout(pages, layerRoot)
    const layout =
      layoutFromAppConfig ||
      layoutFromLegacyConfig ||
      inferredHostAdminLayout ||
      'admin-workspace'

    for (const page of pages) {
      const isLayerPage = typeof page.file === 'string' && page.file.startsWith(layerRoot)
      const isDataSyncRoute = page.path === '/admin/datasync'

      if (isLayerPage || isDataSyncRoute) {
        page.meta = page.meta || {}
        page.meta.layout = layout
      }
    }
  })
}
