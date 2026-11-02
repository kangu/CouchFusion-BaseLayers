# Initial Prompt
Investigate dashboard-related pages returning 404 on SSR/direct load while client navigation works, and fix.

# Plan Followed
1. Reproduce live direct GET /dashboard and inspect content middleware plus route discovery/config propagation.
2. Trace runtime public/server precedence and client-only missing-page tolerance.
3. Publish discovered fixed-route exclusions in public runtime config and merge app/runtime route metadata in middleware.
4. Inspect app auth metadata and syntax-check modified layer files.

# Proposed Next Steps
Deploy/rebuild with updated shared layers/content repository, then restart the app. Check direct authenticated requests and reloads of /dashboard, /dashboard/membership, /members/jobs, /members/community-offerings, /profile and /organizer/meetups; verify normal content-page 404s and application auth remain in place. Restart dev server to rerun config discovery if needed.

# Implementation Summary
Live /dashboard returned HTTP 404 Content page not found. Shared content module discovered fixed pages and merged exclusions only into runtimeConfig.content, while middleware selected runtimeConfig.public.content; client navigation tolerated missing content and obscured the discrepancy. Shared module now publishes auto/manual exclusions and allow overrides into public.content too. Middleware merges app-config discovered prefixes with runtime public prefixes and allowed routes, producing consistent SSR/browser classification instead of losing fixed routes behind config precedence. Existing optional content access checks and page auth middleware remain intact. No app-specific dashboard exclusion list needed. Preserve unrelated existing layer modifications (including i18n edits). No production deployment or data changes performed.

# Validation
Both modified TypeScript files passed Bun syntax transpilation. Inspected dashboard auth middleware remains assigned. No tests, lint, build, authenticated browser checks or production-after-fix verification run.
