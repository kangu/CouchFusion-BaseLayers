# Remove Codex Sessions Feature from Content Layer

## Scope
- Layer: `layers/content`
- Feature removed: Codex Sessions / AI Ops

## Removed
- Admin page:
  - `layers/content/app/pages/admin/ai-ops.vue`
- Client composables:
  - `layers/content/app/composables/useCodexSessions.ts`
  - `layers/content/app/composables/useCodexStream.ts`
- Shared types:
  - `layers/content/types/codex-sessions.ts`
- Server proxy utilities:
  - `layers/content/server/utils/codex-sessions.ts`
- Server API surface:
  - `layers/content/server/api/codex-sessions/**`

## Config cleanup
- Removed `runtimeConfig.codexSessions` from `layers/content/nuxt.config.ts`.
- Removed `public.featureCodexSessions` from `layers/content/nuxt.config.ts`.

## Verification
- Consumer app check: `npx nuxi prepare` in `apps/nuxt-app-starter` passed.
