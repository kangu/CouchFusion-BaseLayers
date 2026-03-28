# Login heading config

## Summary
- added shared auth-layer support for a configurable login page heading
- kept `CouchFusion Login` as the default heading for existing consumers

## Changes
- added `runtimeConfig.public.authLoginHeading` in `layers/auth/nuxt.config.ts`
- updated `layers/auth/app/pages/login.vue` to render the heading from runtime config with a fallback to `CouchFusion Login`
- added a focused test covering:
  - config usage in the login page
  - default value presence in the auth layer
  - consuming app override presence

## Verification
- passed:
  - `bun test layers/auth/app/utils/login-heading.test.ts`

## Notes
- this change only affects the visible `<h1>` on the login page
- subtitle and document metadata remain unchanged
