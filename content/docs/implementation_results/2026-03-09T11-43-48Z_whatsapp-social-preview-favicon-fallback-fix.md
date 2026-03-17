# Initial Prompt
For the social preview image, it seems the current system we have works for Twitter and Facebook. How can we make it work so the preview appears correctly on links shared on WhatsApp?It seems the asset retrieved just now is the favicon.

# Plan
1. Reproduce the crawler behavior difference with a WhatsApp-like user agent.
2. Identify whether locale redirects and/or locale SEO metadata are causing `og:image` to disappear.
3. Implement minimal-impact fixes in the content layer:
   - skip SSR browser-locale redirect for WhatsApp crawler requests,
   - fallback localized page `seo.image` to master document `seo.image` when missing.
4. Verify with `curl` that WhatsApp-like requests now receive HTML including `og:image`/`twitter:image`.

# Implementation Summary
## Root cause
- WhatsApp-like requests were treated as normal browsers in content middleware.
- With `Accept-Language` set to a non-default locale, `/` was redirected (`307`) to locale paths like `/ro`.
- Locale documents can omit `seo.image`, so localized HTML had no `og:image`; preview clients then fell back to favicon.

## Changes made
1. `layers/content/app/middleware/content.global.ts`
- Extended crawler detection regex to include `whatsapp` / `whatsappbot`.
- Effect: WhatsApp crawler requests skip locale redirect logic and can consume canonical OG tags from the shared/default route.

2. `layers/content/server/api/content/pages.get.ts`
- Added read-time fallback for localized page responses:
  - when locale doc exists but `seo.image` is missing/invalid,
  - copy `seo.image` from master document into response payload.
- Effect: direct localized links (e.g. `/ro`) also emit `og:image` and `twitter:image` without requiring locale documents to duplicate image data.

## Verification
- Before fix:
  - `User-Agent: WhatsApp...` + `Accept-Language: ro` on `/` returned `307` to `/ro`.
  - `/ro` head had no `og:image`.
- After fix:
  - same request returns `200` on `/` with OG image tags.
  - `/ro` now also renders with `og:image`/`twitter:image` via master-image fallback.

# Proposed Next Steps
1. In production, re-share a URL in WhatsApp and confirm cache refresh (WhatsApp may cache previews briefly).
2. If needed, add full OG set (`og:title`, `og:description`, `og:url`, `og:type`) for stronger cross-platform consistency.
