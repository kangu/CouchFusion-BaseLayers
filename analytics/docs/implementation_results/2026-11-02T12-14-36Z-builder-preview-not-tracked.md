# Builder previews and builder pages are not visits

## Problem

Editing a page in the content builder counted as traffic in every app:

- The builder (`/builder`, alias `/k`) shows the public page in a live-preview iframe at
  `/?inline-preview=1`. The browser client sent that page's pageview (and any events, outbound
  clicks or component views from it) like a real visit to `/`.
- The builder page itself (`/k`, `/builder/...`) was not in the default excluded paths
  (`/admin*`, `/login`), so each editing session was also a pageview of `/k`.

Found while adding section/game events to `apps/paleologu-prosti`.

## Fix

- `composables/useAnalytics.ts`: `PREVIEW_QUERY_PARAMS = ["inline-preview"]`, `isPreviewUrl()`,
  and `isPreviewPageLoad()`. Whether the page was loaded as a preview is decided once, when the
  module loads; `sendPayload` returns without sending for that page's whole lifetime. Every
  client created from this module is covered: router pageviews, `trackEvent`/`track`,
  `identify`, `v-analytics`, outbound/download auto-capture and `component_view:*`. Deciding at
  load keeps navigations inside the preview untracked even if they drop the parameter.
  `config.debug` logs what was skipped.
- The client imports `useNuxtApp` from `#imports` instead of `#app` (the same function; the
  plugin already uses `#imports`). The shared vitest stub `_tests/stubs/imports.ts` gains
  `useNuxtApp`, so the client can be tested.
- `server/engine/sites.ts`: `DEFAULT_EXCLUDED_PATHS = ["/admin*", "/login", "/builder",
  "/builder/*", "/k", "/k/*"]` for new website records. Exact paths plus `/x/*` prefixes,
  because `*` is a prefix match: `/k*` would also hide `/kids`.
- Docs: README.md / README.html (setup step and troubleshooting row), `agents.md`,
  `docs/self-hosted-analytics.md`.

Existing website records keep their excluded paths: change them in Settings → Website. Done for
`paleologu-prosti` (local); production sites need the same edit once.

## Verification

- `composables/useAnalytics.spec.ts` (jsdom): a normal load sends the pageview and event through
  `sendBeacon`; a load with `?inline-preview=1&preview-motion=reduce` sends nothing for pageview,
  event, identify and a later router navigation to a URL without the parameter (no beacon, no
  fetch); `isPreviewUrl` only matches `inline-preview`. With the guard removed the preview test
  fails.
- `server/engine/exclusions.spec.ts`: the defaults exclude `/admin…`, `/login`, `/builder`,
  `/builder/…`, `/k`, `/k/`, `/k/test/head`; they keep `/`, `/kids`, `/kangaroo/k`,
  `/builders-guild`, `/test/head`, `/logins-explained`.
- `bunx vitest run --config vitest.config.ts analytics` → 78 passed, 2 skipped (opt-in
  integration).
- Live, `apps/paleologu-prosti` dev server, raw events read from CouchDB:
  - builder opened with the fix, old exclusions: one hit, `pv /k`; nothing from the preview of `/`;
  - after adding the builder paths in Settings: opening the builder stored 0 hits;
  - a normal visit to `/` stored `pv /` and `section_view` as before.
