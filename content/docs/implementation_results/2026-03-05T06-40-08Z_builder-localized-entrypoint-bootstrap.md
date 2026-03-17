# Builder Localized Entrypoint Bootstrap

Date: 2026-03-05

## Request
- Opening builder from localized routes like `/k/de/razvan` should:
  - target the base parent page (`/razvan`)
  - activate locale from URL (`de`)

## Implementation
- Updated `ContentAdminWorkbench` bootstrap path resolution:
  - parse `initialPath` through `resolveContentLocalePath`
  - derive and store `{ basePath, locale }` as initial target
  - initialize `activeLocale` from resolved locale
  - match initial page selection by resolved `basePath`

## File Updated
- `content/app/components/admin/ContentAdminWorkbench.vue`

## Validation
- `bun run build` in `apps/radustanciu` passed (SSR/client build successful).
