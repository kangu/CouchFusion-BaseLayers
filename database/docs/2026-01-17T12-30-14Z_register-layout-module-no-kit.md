## Initial Prompt
Run "bun run dev" inside bitvocation and iterate until it works, it currently fails with error ERROR Cannot start nuxt: Could not load /Users/radu/Projects/nuxt-apps/layers/database/utils/register-layout. Is it installed?

## Implementation Summary
Implementation Summary: Updated the register-layout module to export a plain Nuxt module function without @nuxt/kit so it resolves in this monorepo, allowing dev server startup to proceed.

## Documentation Overview
- The database layout module now avoids @nuxt/kit imports and registers the pages:extend hook directly via the Nuxt module function.

## Implementation Examples
```ts
export default function registerDatabaseLayoutModule(_options: any, nuxt: any) {
  nuxt.hook('pages:extend', (pages: any[]) => {
    // apply layout metadata
  })
}
```
