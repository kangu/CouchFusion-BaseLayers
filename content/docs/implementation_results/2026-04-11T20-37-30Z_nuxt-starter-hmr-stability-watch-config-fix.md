# Nuxt Starter: HMR Stability Fix (Watch Graph / Dev Output)

## Scope
- App: `apps/nuxt-app-starter`
- Goal: reduce dev-state breakage after code edits that forced restarting `bun run dev`

## Root Cause
The starter app had a custom Vite watch override with an invalid glob pattern:
- `vite.server.watch.ignored = ['!**/node_modules/**']`

That pattern can override default watcher exclusions and destabilize the watch graph in a layered repo.

The app also always forced custom Nitro output directories under `.output/dist`, including in dev, which increases generated-file churn in the workspace during HMR.

## Changes Applied
File: `apps/nuxt-app-starter/nuxt.config.ts`

1. Removed custom Vite watch override entirely:
- Removed `vite.server.watch` block (`usePolling` + invalid `ignored` pattern).
- Kept only `vite.server.fs.allow`.

2. Made custom Nitro output production-only:
- Added `isProduction = process.env.NODE_ENV === 'production'`.
- `nitro.output` is now applied only when `isProduction` is true.
- In dev, Nuxt/Nitro uses default dev output behavior.

## Verification
- `cd apps/nuxt-app-starter && npx nuxi prepare` -> passed.
- Started dev server on isolated port `6024`.
- Triggered 3 consecutive source-file edits.
- Observed stable HMR update logs (`Vite server hmr 1 files`) and healthy endpoints:
  - `GET /_nuxt/builds/meta/dev.json` -> `200`
  - `GET /` -> `200`

## Runtime Impact
- Dev-only stability improvement.
- No production runtime behavior change except retaining intended custom Nitro output path in production builds.
