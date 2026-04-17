# Reserve /login globally in content routing

## Request
Reserve `/login` globally in the content route utility so auth login page is not intercepted as a content page.

## Change
Updated shared content route reservation list in `layers/content/utils/content-route.ts`:
- Added `"/login"` to `RESERVED_CONTENT_PREFIXES`.

This ensures `isContentRoute('/login', ...)` returns `false` for all consuming apps, preventing content middleware from attempting `fetchPage('/login')`.

## Verification
- `cd apps/nuxt-app-starter && bunx nuxi prepare` passed.
- `curl -I http://localhost:6018/login` now returns `HTTP/1.1 200 OK`.

## Files
- `layers/content/utils/content-route.ts`
