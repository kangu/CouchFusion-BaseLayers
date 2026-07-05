# Layer: email

`Runtime: nuxt 4.1.x, vue 3.5.x`

Shared email template management layer for CouchFusion apps. Provides MJML template CRUD with live preview, editable text/href extraction, placeholder detection, an admin editor built on CodeJar + Prism, a server-side template queue, and fallback toast UI. Consumed by: bitvocation, couchfusioncom, gas-maintenance.

## Folder map

- `app/components/` — `ToastFallback.vue`, `admin/PrismCodeJar.vue` (code editor wrapper).
- `app/composables/` — `useEmailTemplates.ts`, `useEmailToast.ts` (auto-imported).
- `app/pages/admin/email-templates/` — admin CRUD pages.
- `server/api/email-templates/` — endpoints: `index.get.ts`, `index.post.ts`, `[id].get.ts`, `[id].put.ts`, `extract-texts.post.ts`.
- `server/utils/` — `email-templates.ts` (extraction + MJML helpers), `template-queue.ts` (queue service). Spec files colocated.
- `utils/register-layout.ts` — Nuxt module registering admin nav.
- `docs/implementation_results/` — task notes.
- `vitest.config.ts` — standalone vitest config (server specs only).
- `nuxt.config.ts` — registers `#email` alias + layout module.
- `README.md` — overview.

## Public API / Exports

- Alias: `#email` — e.g. `#email/server/utils/email-templates`, `#email/server/utils/template-queue`.
- Auto-imported composables: `useEmailTemplates`, `useEmailToast`.
- Component prefix: `Email*`-style components under `app/components/admin/` (e.g. `PrismCodeJar`, `ToastFallback` — no explicit prefix configured).
- Server utils (auto-imported in Nitro): `EMAIL_DATABASE_NAME` (`'email-sender'`), `getEmailTemplatePrefix`, `getEmailTemplateEndKey`, `extractTemplatePlaceholders`, `extractEditableMjmlTexts`, types `MjmlTextExtractionResult`, `MjmlHrefLink`; `queueTemplateEmail`, `QueueTemplateEmailInput`, `QueueTemplateEmailResult`.
- Server endpoints under `/api/email-templates/*` and `/api/email-templates/extract-texts`.
- Admin nav: registers `email` section with `/admin/email-templates` route (requires `admin` role).

## Conventions

- Templates are stored in CouchDB database `email-sender` (see `EMAIL_DATABASE_NAME`), keyed with a server-side prefix derived from `dbLoginPrefix`.
- Editable texts are extracted from MJML via `extractEditableMjmlTexts`; `mj-style` content is ignored.
- Use `#email` alias for cross-layer imports; avoid relative paths.
- Keep specs colocated: `*.spec.ts` next to source under `server/utils/`.
- Admin session is enforced via `#auth/server/utils/assert-admin-session` `assertAdminSession` — do not reimplement auth.

## Dependencies

- Runtime peerDeps: `nuxt ^4.0.0`, `codejar ^4.2.0`, `prismjs ^1.29.0`, `mjml-browser ^4.0.0`.
- Depends on the `auth` layer (imports `#auth/server/utils/assert-admin-session`) — consuming app must extend `layers/auth`.
- Depends transitively on `database` layer (CouchDB client) via `#auth`/`#database`.
- Expects CouchDB `email-sender` database to exist (created via database layer's `initializeDatabase`).

## Build / Test commands

- Standalone tests: `vitest run` (uses `vitest.config.ts`, includes `email/server/**/*.spec.ts`).
- From repo root: `npx vitest run layers/email`.
- No standalone lint/typecheck script; run via a consuming app (e.g. `apps/bitvocation`): `bun run typecheck`, `bun run lint`.

## Gotchas / Pitfalls

- `mjml-browser` is the browser variant; do not import server `mjml` in `app/` code.
- `PrismCodeJar.vue` lazy-loads `codejar` and `prismjs` — ensure these are in the consuming app's deps.
- Template prefixing is server-side only; never compute prefix in client code.
- `extract-texts.post.ts` re-runs extraction on demand; persist detected values via `[id].put.ts` (see `2026-03-26T08-27-53Z` doc).
- Toast fallback (`ToastFallback.vue`) is used when the host app has no global toast provider.
- `queueTemplateEmail` writes to the same `email-sender` DB — failures are non-fatal to template save.

## Cross-references

- Root conventions: `/Users/radu/Projects/nuxt-apps/AGENTS.md`
- Layer docs: `docs/implementation_results/`
- Depends on: `layers/auth`, `layers/database`
- Related skills: `couchfusion-layer-builder`
- Consumers: `apps/bitvocation`, `apps/couchfusioncom`, `apps/gas-maintenance`
