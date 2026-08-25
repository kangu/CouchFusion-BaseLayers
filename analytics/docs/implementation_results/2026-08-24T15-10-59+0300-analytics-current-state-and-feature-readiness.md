# Analytics Current-State and Feature-Readiness Review

## Initial Prompt

Analyse the current project state thoroughly, consider all involved aspects, review past work from the `/docs` folders, and prepare to implement feature work.

## Scope

- Selected target: `layers/analytics`.
- Reviewed the layer instructions, source, runtime config, public API, documentation history, implementation-result records, generated Nuxt metadata, consuming-app configuration, current usages, tests, TypeScript diagnostics, and security/privacy implications.
- No implementation source was changed. Nuxt's ignored `.nuxt` metadata was regenerated in `apps/bitvocation` for plugin-discovery verification.

## Current Architecture

- `composables/useAnalytics.ts` builds first-party analytics payloads and sends them to `POST /api/stats`.
- Browser transport prefers `navigator.sendBeacon`, then `fetch(..., { keepalive: true })`; non-browser execution awaits a regular `fetch`.
- `plugins/analytics.client.ts` injects `$analytics` and `$umami`, registers `v-analytics`, and sends an event after every router navigation.
- `plugins/analytics.server.ts` registers an SSR-safe directive stub.
- `plugins/component-analytics.client.ts` observes `[data-analytics-track="true"]` elements and records per-route component visibility once per browser session.
- `server/api/stats.post.ts` resolves Umami configuration, optionally reads CouchDB `_config`, applies route exclusions, forwards client metadata and the event payload to `${proxyHost}/api/send`, and maps upstream failures to HTTP 502.
- The layer has no package manifest, standalone test configuration, lint script, or typecheck entry point.

## Corrected Plugin-Discovery Finding

The March 2026 readiness reports said `component-analytics.client.ts` was dormant because it was not listed in `nuxt.config.ts`. That conclusion is no longer correct.

After running `bunx nuxt prepare` in `apps/bitvocation`, the regenerated `.nuxt/types/plugins.d.ts` included:

- `analytics.client`
- `analytics.server`
- `component-analytics.client`

Nuxt auto-discovers the component plugin from the layer's legacy `plugins/` directory. The component tracker is active, but it remains undocumented in the main README and lacks focused tests.

## Documentation History

1. The October-November 2025 implementation started as an Umami script-loader/proxy integration using `plugins/umami.client.ts`, `/script.js`, `/api/send`, and later `/api/umami-script`.
2. November 2025 work added readiness polling, route deduplication, script MIME/CORS workarounds, and excluded-path manual tracking.
3. The architecture was then replaced with a first-party `/api/stats` event pipeline, `v-analytics`, `$analytics`/`$umami` compatibility injection, and events-only upstream payloads.
4. March 2026 reviews correctly identified documentation drift and missing layer tests, but incorrectly classified the component plugin as dormant.
5. The March 8 change added CouchDB `_config` fallback using `cf_env_[slug]`.
6. The March 30 change added unload-safe `sendBeacon`/keepalive transport and two passing transport tests in Bitvocation.

The README and several reference docs still describe the removed script-loader architecture. `hostUrl`, `scriptPath`, `dataDomains`, and `autoTrack` remain in runtime config but are not consumed by current source code.

## Adoption and Integration State

Eleven apps currently extend the Analytics layer:

- `bitvocation`
- `couchfusioncom`
- `forest-cabin`
- `kangu`
- `kids-store`
- `lovable-gifts-sdd`
- `lovable-test`
- `nuxt-app-starter`
- `radustanciu`
- `smart-lead`
- `testing-1`

The layer instructions list only nine and should be updated. `lovable-test` intentionally overrides `/api/stats` with an inert fixture response. `pacanele-landing` has its own unrelated local `useAnalytics()` composable and does not consume this layer.

Configuration is inconsistent across consumers:

- Some apps configure private `runtimeConfig.analytics.umami` values, which the server reads directly.
- Others configure only `runtimeConfig.public.analytics.umami`; the browser-provided `website` value can keep events working, but public `excludedPaths` is not used by the server.
- Many apps still configure script-loader-only properties that have no effect.

## Key Findings

### High: Sensitive URLs can be forwarded to Umami

Automatic navigation tracking includes `pathname + search + hash`. Server exclusions compare the raw value without removing query/hash or normalizing dynamic paths.

Bitvocation defaults to excluding only `/confirm-login`, while the real route is `/confirm-login/[email]/[token]`. CouchFusion also has `/developers/confirm-login/[email]/[token]`. Unless deployment-specific CouchDB configuration supplies a matching wildcard, email addresses and login tokens can be sent to the analytics provider through automatic route events.

Required remediation:

- Never include URL fragments.
- Strip or allow-list query parameters.
- Match exclusions against a normalized pathname.
- Use prefix/glob exclusions for all auth, admin, preview, and tokenized routes.
- Apply exclusions before payload dispatch as well as on the server.
- Add regression tests using nested token routes and query/hash variants.

### Medium: Public excluded-path configuration is ineffective

The documented `runtimeConfig.public.analytics.umami.excludedPaths` is not read by `analytics.client.ts`, and `stats.post.ts` reads only private exclusions or CouchDB values. Several consumers configure exclusions only under `public`, so they still emit and forward events for those paths.

### Medium: CouchDB `_config` adds three reads to every event

`stats.post.ts` performs three CouchDB requests before validating the request body and even when runtime configuration already supplies sufficient values. There is no cache. This adds avoidable latency and creates a request-amplification path on a public endpoint.

Resolve runtime values first, fetch only missing keys, and cache `_config` results with a bounded TTL and safe invalidation strategy.

### Medium: Public endpoint lacks abuse controls

`POST /api/stats` has no request-size cap, rate limit, event-name/data allow-list, or payload-depth limit. An unauthenticated caller can force CouchDB reads and upstream Umami requests, pollute metrics, or consume server/upstream capacity.

At minimum, add a body-size limit and an edge/server rate limit. A robust implementation should also validate event names, cap data depth/size, and add rejection metrics without logging payload contents.

### Medium: Strict TypeScript does not pass for the layer

Using the freshly generated Bitvocation `.nuxt/tsconfig.json`, Analytics-specific errors include:

- unsupported `navigator.userLanguage`
- inferred payload shape rejecting optional `referrer`, `title`, `appName`, and `website`
- implicit `any` parameters in tracking methods
- incompatible runtime-config typing for `excludedPaths`
- deprecated/invalid `process.server` typing
- `useAnalytics()` inference producing `{}` in the component plugin
- invalid Nuxt hook name `app:beforeDestroy`
- unsafe normalized-payload property inference in the server route
- possible undefined first `x-forwarded-for` entry

The consumer-wide typecheck also has many unrelated errors, so Analytics needs a standalone test/typecheck harness to make its own quality gate actionable.

### Medium: Documentation and runtime contract have diverged

- README claims Umami script auto-loading, but the current client does not load a script.
- `hostUrl`, `scriptPath`, `dataDomains`, and `autoTrack` are dead configuration.
- README claims public exclusions control tracking, which is currently false.
- Agent instructions misstate consumer count and component-plugin registration.
- Historical docs are useful records but are not marked as legacy architecture.
- `content.ignore: ['/redir']` is unrelated cross-layer configuration and should be removed or explicitly justified.

### Low: Analytics integrity and lifecycle weaknesses

- Forwarded IP selection trusts incoming proxy headers without documenting trusted-proxy assumptions, enabling attribution spoofing in some deployments.
- Component-view event shape differs from old Bitvocation docs: current code emits `component_view:<id>` and omits `id` from data.
- `app:beforeDestroy` is not a valid current Nuxt hook, so observer cleanup is not reliably registered.
- The layer enables Nuxt devtools from reusable layer config, which may override consumer expectations.
- `.DS_Store` artifacts are present.

### Process risk: source is ignored by the root Git repository

Root `.gitignore` ignores `layers`, and `layers/analytics` is not a nested Git repository. `git status`, `git log`, and `git ls-files` therefore provide no source history or change protection for this layer. Past work can only be reconstructed from the dated docs and current files. This should be confirmed as intentional before substantial feature work.

## Privacy and Compliance Notes

The default payload includes URL, hostname, language, screen size, timezone, title, referrer, user agent, and forwarded client IP. The layer has no consent/opt-out integration, retention statement, payload redaction policy, or documented DPA expectations for the analytics provider.

Before broader deployment, define the lawful basis, data minimization rules, retention period, user opt-out behavior, and provider agreement. Do not log full rejected payloads because they may contain the same sensitive URLs the remediation is intended to remove.

## Verification Results

- PASS: `bunx nuxt prepare` in `apps/bitvocation`.
- PASS: `./layers/node_modules/.bin/vitest --config layers/bitvocation-content.vitest.config.ts apps/bitvocation/tests/analytics/analytics-transport.spec.ts --run`.
  - 1 test file passed.
  - 2 tests passed: `sendBeacon` and keepalive-fetch fallback.
- FAIL: documented `nuxt typecheck` workflow cannot start because consuming apps such as Bitvocation and `lovable-gifts-sdd` have no root `tsconfig.json`.
- FAIL: direct TypeScript diagnostics against the generated Bitvocation config report the Analytics-specific errors listed above, plus many unrelated consumer/layer errors.
- NOT COVERED: `/api/stats`, directive behavior, component visibility tracking, exclusion matching, CouchDB fallback, config precedence, upstream error mapping, rate limiting, privacy redaction, and consent behavior.

## Recommended Readiness Sequence

1. **Privacy-safe URL and exclusion contract**
   - Normalize/redact route data.
   - Unify private, public, and CouchDB configuration precedence.
   - Protect dynamic auth/token routes.
   - Add client and server regression tests first.
2. **Standalone Analytics quality harness**
   - Add layer-local Vitest configuration, Nuxt/H3 stubs, and an actionable TypeScript check.
   - Fix all Analytics-owned type errors.
3. **Server efficiency and abuse resistance**
   - Validate before external reads.
   - Cache CouchDB config and fetch only missing keys.
   - Add body limits, event validation, and rate limiting.
4. **Component tracking hardening**
   - Define the canonical event shape.
   - Fix lifecycle hooks and typing.
   - Add IntersectionObserver/session-deduplication tests.
5. **Documentation and config cleanup**
   - Rewrite README for the first-party event architecture.
   - Remove or formally deprecate dead script settings.
   - Mark 2025 script-proxy docs as legacy.
   - Update `agents.md` and consumer examples.
6. **Feature expansion only after the above gates**
   - Candidate features include consent/opt-out, a typed event catalog, provider abstraction, delivery observability/retries, and privacy-preserving aggregation.

## Recommended Next Feature

Implement **Privacy-safe analytics routing and exclusions** first. It has the highest risk reduction, resolves the inconsistent configuration contract, and creates the test seams needed for later features.

A concrete feature specification should be agreed before creating the required task-by-task implementation plan under `docs/superpowers/plans/`.
