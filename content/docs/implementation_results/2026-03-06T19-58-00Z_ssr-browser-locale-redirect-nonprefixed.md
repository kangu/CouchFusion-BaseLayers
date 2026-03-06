# SSR browser-locale redirect for non-prefixed content routes

## Scope
Implemented in content layer route middleware to support SSR redirects from non-prefixed URLs to localized URLs when a locale document exists.

## File changed
- `layers/content/app/middleware/content.global.ts`

## Behavior implemented
1. SSR-only locale redirect check
- Runs only on server-side route middleware execution (`import.meta.server`).

2. Redirect source scope
- Applies only when request enters through non-prefixed/default-locale path (e.g. `/`, `/about`).
- Does not trigger on already locale-prefixed paths (`/es/...`, `/fr/...`).

3. Browser locale detection
- Parses `Accept-Language` with quality (`q`) handling.
- Matches to supported configured locales.

4. Localization availability check
- Redirects only if locale page exists as a real localized document:
  - uses `store.fetchPage(basePath, { locale })`
  - requires `summary.localization.hasLocaleDocument === true`

5. Search engine indexing safety
- Skips locale redirects for crawler user agents.
- Uses `307 Temporary Redirect` for browser requests.

## Playwright verification
Using Playwright MCP against `http://localhost:7833/` with:
- `Accept-Language: es-ES,es;q=0.9,en;q=0.8`
- normal browser user-agent

Observed:
- probe request status: `307`
- `Location` header: `/es`
- browser final URL: `http://localhost:7833/es`
- final status: `200`

## Notes
- Existing content fetch and 404 behavior remain unchanged for all other paths.
- Impact limited to middleware redirect logic; no API contract changes.
