## Initial Prompt
Make the nuxt.config.ts add for modules. I removed the pages:extend myself

## Implementation Summary
Implementation Summary: Wired the database layer to load the register-admin-pages Nuxt module via the modules array so admin page metadata is applied through the module hook.

## Documentation Overview
- `layers/database/nuxt.config.ts` now includes the module entry to register admin page metadata from `utils/register-admin-pages`.

## Implementation Examples
```ts
modules: [
  fileURLToPath(new URL('./utils/register-admin-pages', import.meta.url)),
],
```
