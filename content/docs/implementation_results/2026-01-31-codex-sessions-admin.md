# Codex Sessions Admin Integration

## Summary
- Added admin-facing Codex Sessions page (`/admin/ai-ops`) to start/monitor Codex CLI sessions.
- Implemented secure proxy endpoints under `server/api/codex-sessions/*` (admin-only) with SSE passthrough and config exposure.
- Added composables/types for session CRUD + SSE streaming, and documented runtime config requirements.

## Key Files
- `app/pages/admin/ai-ops.vue` – UI for creating/stopping sessions and viewing live stream/state.
- `app/composables/useCodexSessions.ts`, `useCodexStream.ts` – API helpers and SSE client.
- `types/codex-sessions.ts` – shared types.
- `server/utils/codex-sessions.ts` and `server/api/codex-sessions/*` – proxy + auth + SSE piping.
- `docs/codex-sessions-admin.md` – setup and UX notes.

## Notes
- Feature flag via `public.featureCodexSessions`; backend URL/token and allowlist set in `runtimeConfig.codexSessions`.
- Streams truncate to the last 50 events in UI (500 in buffer); discovery caps displayed from config but still enforced by backend.

## Follow-ups
- Expose richer SSE payloads (structured JSON + command counts) from backend and render them in UI.
- Add integration test harness that mocks `cli-agent-wrap` SSE for the proxy routes.
- Add metrics pill fed from `/codex-sessions/health` and document log retention policy.
