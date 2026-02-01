# Codex Sessions Admin Page

## Overview
An admin-facing page (`/admin/ai-ops`) lets authorized users start and monitor Codex CLI sessions that are orchestrated by `cli-agent-wrap`. The UI is feature-flagged and enforced server-side via admin auth and proxy endpoints.

## Runtime config
Add these keys in the consuming app’s `nuxt.config.ts`:
```ts
export default defineNuxtConfig({
  runtimeConfig: {
    codexSessions: {
      serverUrl: process.env.CODEX_SESSIONS_URL,
      token: process.env.CODEX_SESSIONS_TOKEN,
      allowedRoots: ['/Users/radu/Projects/nuxt-apps'],
      discoveryCaps: {
        maxSeconds: 60,
        maxBytes: 200000,
        maxCommands: 5,
      },
    },
    public: {
      featureCodexSessions: true,
    },
  },
})
```
- `serverUrl` and `token` point to the running `cli-agent-wrap` service.
- `allowedRoots` constrains selectable roots in the UI and is enforced again in the proxy.
- `discoveryCaps` surfaces limits in the UI (backend still enforces its own limits).
- Toggle `featureCodexSessions` to show/hide the admin page.

## Server proxy endpoints
Implemented under `server/api/codex-sessions/*` (all admin-protected):
- `POST /codex-sessions` → create session (root, prompt, ttl_sec)
- `POST /codex-sessions/:id/input`
- `POST /codex-sessions/:id/stop`
- `DELETE /codex-sessions/:id`
- `GET /codex-sessions/:id/status`
- `GET /codex-sessions/:id/stream` (SSE passthrough)
- `GET /codex-sessions/health`
- `GET /codex-sessions/config` (allowed roots + discovery caps for the UI)

## Client pieces
- Composables: `useCodexSessions` (CRUD + config) and `useCodexStream` (SSE with reconnect + ring buffer).
- Types: `types/codex-sessions.ts` centralizes API shapes.
- Page: `app/pages/admin/ai-ops.vue` (layout=false, middleware auth). Includes start form, live stream, status cards, and stop/refresh controls.

## UX notes
- Root dropdown uses `allowedRoots`; when empty, a freeform input is shown.
- Discovery caps (seconds/bytes/commands) are displayed inline; backend still enforces hard limits.
- Streams are truncated to the last 50 events in the UI; composable keeps a 500-event ring buffer.
- Stop button issues `/stop`; SSE disconnects on terminal states.

## Testing
- `go test ./...` (cli-agent-wrap) already covers policy and session limits.
- Recommended app-level tests: mock `cli-agent-wrap` with an SSE test server and call the proxy routes; component tests for form validation and command-cap UI disabling.

## Next enhancements
- Enrich SSE payload handling (structured JSON) and expose command count from backend events.
- Add metrics/health pill fed from `/codex-sessions/health` polling.
- Add retention/rotation job for `llm-logs` if not already handled by the service.
