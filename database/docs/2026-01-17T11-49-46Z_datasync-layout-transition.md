## Initial Prompt
When I click on Data Sync from any of the admin pages, why do I get a full a redraw of the layout instead of a regular client page-only transition? Apply the proposed fix

## Implementation Summary
Implementation Summary: Moved the Data Sync layout selection into the database layer’s pages:extend hook using appConfig, removing runtime setPageLayout so the admin layout stays stable during client navigation.

## Documentation Overview
- The Data Sync page now relies on `pages:extend` metadata for its layout, avoiding full layout remounts during navigation.
- The layout name is read from `appConfig.uiNavigation.adminLayout` with a `default` fallback.

## Implementation Examples
```ts
hooks: {
  'pages:extend': (pages, nuxt) => {
    const adminLayout = nuxt.options.appConfig?.uiNavigation?.adminLayout || 'default'
    for (const page of pages) {
      if (page.path === '/admin/datasync') {
        page.meta = page.meta || {}
        page.meta.layout = adminLayout
      }
    }
  },
},
```
