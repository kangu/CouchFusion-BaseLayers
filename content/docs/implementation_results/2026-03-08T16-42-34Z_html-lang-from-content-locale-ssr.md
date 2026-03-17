# HTML `lang` From Content Locale (SSR-safe)

## Request
Update the `<html lang>` attribute using the current content locale and ensure SSR correctness.

## Implementation
- Added a new content-layer plugin:
  - `layers/content/app/plugins/content-locale-html-lang.ts`
- The plugin:
  - reads runtime content i18n config
  - resolves locale from current route via `resolveContentLocalePath(...)`
  - sets `useHead({ htmlAttrs: { lang } })` reactively
- Registered the plugin in `layers/content/nuxt.config.ts` so it runs in all apps consuming the layer.

## SSR behavior
- On SSR request render, route locale is resolved server-side and emitted into the initial HTML `<html lang="...">`.
- On client route navigation, the same reactive head binding updates `lang` to match the active locale path.

## Impact
- Layer-level only change.
- No API contract changes.
- Minimal impact on consuming apps.
