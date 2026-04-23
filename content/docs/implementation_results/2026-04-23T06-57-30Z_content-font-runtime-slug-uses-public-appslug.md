# Content Font Runtime Slug Uses Public AppSlug

## Initial Prompt

Why is the `content_fonts_allowlist` not read correctly in production? I only see the default list.

## Plan Followed

- Trace the content font runtime-config resolution path.
- Confirm how the `_config` section slug is derived.
- Add a focused regression test for slug resolution precedence.
- Fix the content layer so it prefers `runtimeConfig.public.appSlug` over `process.cwd()`.

## Implementation Summary

The production issue came from the content layer deriving the CouchDB `_config` slug from `process.cwd()` instead of the app slug exposed by the consuming app.

Before the fix:
- `getContentFontRuntimeConfig()` resolved the slug from the current working directory name.
- In production Nitro/server environments, that can differ from the app folder name.
- When the resulting section was wrong, `_config` reads missed and the code fell back to the default allowlist.

After the fix:
- Added `resolveContentFontRuntimeSlug()` to [layers/content/server/utils/content-fonts.ts](/Users/radu/Projects/nuxt-apps/layers/content/server/utils/content-fonts.ts:1).
- `getContentFontRuntimeConfig()` now prefers `runtimeConfig.public.appSlug`.
- Only when `public.appSlug` is missing does it fall back to the normalized working-directory basename.

## Verification

- `bunx vitest --config content/vitest.fonts.config.ts --run content/tests/server/font-assets.spec.ts`
- `./layers/node_modules/.bin/vitest --config layers/bitvocation-content.vitest.config.ts --run`
- `git diff --check -- layers/content/server/utils/content-fonts.ts layers/content/tests/server/font-assets.spec.ts`

Passed:
- content font test suite: `1` file, `5` tests
- Bitvocation suite: `15` files, `34` tests

## Notes

- The new regression test proves `runtimeConfig.public.appSlug` wins over a misleading cwd fallback, which is the production case that was causing the wrong `_config` section lookup.
