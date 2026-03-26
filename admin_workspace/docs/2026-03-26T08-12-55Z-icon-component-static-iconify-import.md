# Icon Component Static Iconify Import

## Summary
- Updated `app/components/Icon.vue` to statically import `@iconify/vue` and render icon glyphs reliably in browser runtime.

## Why
- Dynamic module loading with `@vite-ignore` caused unresolved module specifier behavior in browser runtime, producing fallback placeholders in sidebar links.

## Change
- Added static import:
  - `import { Icon as IconifyIcon } from "@iconify/vue"`
- Rendered `IconifyIcon` directly.
- Removed obsolete fallback branch used only for failed dynamic load.

## Verification
- Confirmed in consuming app (`apps/gas-maintenance`) that sidebar icons render as actual glyphs on `/admin/maintenance/jobs`.
- `bun run build` passed in consuming app.
