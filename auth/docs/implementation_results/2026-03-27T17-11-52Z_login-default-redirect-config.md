# Login default redirect config

## Summary
- added shared auth-layer support for a configurable default post-login redirect path
- preserved existing `redirectTo` cookie precedence
- kept `/builder` as the auth-layer default for existing consumers

## Changes
- added `public.authDefaultRedirectPath` to the auth layer runtime config with default `/builder`
- extracted login redirect fallback logic into a small helper
- updated the shared login page to read the configured default path instead of hardcoding `/builder`

## Files
- `layers/auth/nuxt.config.ts`
- `layers/auth/app/pages/login.vue`
- `layers/auth/app/utils/login-redirect.ts`
- `layers/auth/app/utils/login-redirect.test.ts`

## Verification
- passed:
  - `bun test layers/auth/app/utils/login-redirect.test.ts`

## Notes
- consuming apps can now override the fallback target without shadowing the auth-layer login page
- if `redirectTo` cookie is set, that value still wins over the configured default
