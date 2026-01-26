# Context
- Layer: `layers/content`
- Feature: Reusable social image meta generation with ImageKit transforms
- Goal: Extract social-image head tag logic into a shared composable for app consumers.

# Changes
- Added `app/composables/useSocialImageMeta.ts`, providing a computed meta array for `og:image` / `twitter:image` plus `twitter:card`, with optional transform overrides.
- Default transforms target platform dimensions when the source host is `ik.imagekit.io`: `w-1200,h-630,fo-auto` (OG) and `w-1200,h-628,fo-auto` (Twitter); non-ImageKit URLs pass through untouched.
- Consumers pass a reactive `image` value and spread the returned `socialImageMeta` into existing head meta arrays.

# Verification
- Manual via consuming app (bitvocation): head meta rendered with transformed ImageKit URLs for both OG and Twitter after integrating the composable. No automated tests run.***
