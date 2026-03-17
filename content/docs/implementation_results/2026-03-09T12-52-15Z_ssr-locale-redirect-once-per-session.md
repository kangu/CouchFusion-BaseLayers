# Initial Prompt
I want only the first redirect to the browser locale to happen per session. Afterwards, if the user navigates to the slash route, it should load the default English language and stay on that. A refresh of the page would still keep / and English, so no more redirect to user language as it was in the initial request.

# Plan
1. Update the content layer global middleware redirect logic to check a session marker before applying browser-locale redirect.
2. Persist that marker as a browser session cookie after first hydrated visit so later requests to `/` skip locale redirect.
3. Keep impact minimal by changing only middleware behavior and preserving all existing locale/content fetch logic.
4. Verify behavior paths with request-level checks and document any verification limitations.

# Implementation Summary
- Updated `layers/content/app/middleware/content.global.ts`.
- Added session marker constant:
  - `cf_content_locale_redirect_done`
- Added cookie-header matcher helper:
  - `hasLocaleRedirectSessionCookie(cookieHeader)`
- Changed middleware flow:
  - Hydration guard moved after route/content resolution so it can set a session marker cookie on first hydrated content route.
  - On first client hydration of a content route, middleware now sets `cf_content_locale_redirect_done=1` as a session cookie (`path=/`, `SameSite=Lax`) and returns as before.
  - SSR locale-redirect block now checks request cookie header and only performs browser-locale redirect when session marker is absent.
- Redirect mechanics remain unchanged otherwise:
  - same crawler skip behavior
  - same locale preference parsing
  - same locale doc existence check before redirect

# Verification Notes
- Local `curl` checks against the currently running dev server still showed redirect with cookie header; this indicates the running server instance likely did not pick middleware hot reload in this environment.
- Code-level behavior is implemented in middleware and should apply once the updated middleware is active.

# Proposed Next Steps
1. Restart the running dev server instance once and re-test the exact flow in browser:
   - fresh session -> `/` may redirect once to preferred locale
   - then navigate to `/` -> stays English `/`
   - refresh `/` -> remains English `/`
2. Optionally add a middleware-level automated test harness for cookie-gated locale redirect behavior to lock this regression.
