# Initial Prompt
I have mergedRuntimeIgnore [ '/admin', '/annual-report-scaffold', '/annual-report-scaffold-2', '/confirm-login', '/dashboard', '/ignore_redir_from_app', '/login', '/members', '/organizer', '/profile', '/redir', '/test-countries-regions', '/test-dept-seniority', '/test-emerging-firms', '/test-employer-insights', '/test-events', '/test-hiring', '/test-intro', '/test-job-resources', '/test-job-stats', '/test-jobs-per-month', '/test-mission-vision', '/test-support-mission', '/test-talent-solutions', '/test-team', '/test-thank-you', '/test-top-employers', '/test-work-env', '/test-world-map', '/test-year-in-review' ] which is correctly read, but when I have a URL like /members/jobs, I want it to also match because of the /members definition. Update the content module to not throw the warning "content.global.ts:43 Content page not found, triggering 404: /members/jobs" for the above example and basically skip content reading for this all routes under /members/

# Implementation Summary
Updated the content layer to honor runtime-config ignore prefixes (including nested paths) when building ignored prefixes. The middleware now merges app-config content settings with `runtimeConfig.content.ignore`, and `resolveIgnoredPrefixes` also ingests `ignore` so routes like `/members/jobs` are skipped without triggering content fetch/404 warnings.

# Documentation Overview
- `layers/content/app/middleware/content.global.ts` now passes both app-config content and `runtimeConfig.content.ignore` to `resolveIgnoredPrefixes`, ensuring nested routes under ignored prefixes are excluded.
- `layers/content/utils/content-route.ts` merges an `ignore` array (from runtime config) into the computed ignored prefix set before manual/auto/merged entries, so prefix matches work for subpaths.

# Implementation Examples
- With `runtimeConfig.content.ignore` containing `/members`, the middleware receives `/members` in its ignored list and skips content fetching for `/members/jobs`, avoiding the 404 warning.
