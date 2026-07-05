# Layer: maintenance

`Runtime: nuxt 4.x, vue 3.5.x`

Domain layer for gas-appliance maintenance operations: clients/contacts, contract & gas-sensor expiry lifecycle, maintenance jobs workflow, employee roster, notification dispatch, and an admin dashboard. Consumed by `apps/gas-maintenance` (see `apps/gas-maintenance/nuxt.config.ts` extends array).

## Folder map
- `app/pages/admin/maintenance/` — admin pages: `index.vue`, `jobs.vue`, `clients.vue`, `employees.vue`, `notifications.vue`. All use `admin-workspace` layout + `auth`/`role-auth` middleware.
- `app/utils/client-form.ts` — client-side form normalization (gas sensor fields).
- `server/plugins/init.ts` — DB init, legacy contract migration, cron scheduler bootstrap.
- `server/api/maintenance/` — REST endpoints under `/api/maintenance/**` (clients, jobs, employees, notifications, settings, dashboard, cron).
- `server/utils/` — domain logic: `config.ts`, `maintenance-db.ts`, `design-documents.ts`, `cron.ts`, `dashboard.ts`, `contacts.ts`, `audit.ts`, `parsers.ts`, `dates.ts`, `assert-maintenance-role.ts`, `notification-adapters.ts`, `email-template-payload.ts`, `types.ts`.
- `utils/employee-display.ts` — shared display helper (used by `#maintenance/utils/employee-display`).
- `docs/` — dated implementation notes (MVP, schedules, SMS integration, etc.).
- `README.md` — short feature summary.

## Public API / Exports
- Alias: `#maintenance` → layer root.
- App config contribution: `appConfig.adminWorkspace.sections` (id `maintenance`) and `appConfig.uiNavigation.sections` (id `maintenance`) — registers admin sidebar entries: Jobs, Clients, Notifications, Employees.
- Client util import: `#maintenance/utils/employee-display` → `getEmployeeDisplayLabel`.
- Server utils are not auto-imported; import explicitly from `#maintenance/server/utils/<file>` or relative path.
- HTTP endpoints (all under `/api/maintenance`):
  - `GET/POST /api/maintenance/clients`, `DELETE/PATCH /api/maintenance/clients/:id`
  - `GET /api/maintenance/jobs`, `PATCH /api/maintenance/jobs/:id/{status,reschedule,assign}`
  - `GET/POST /api/maintenance/employees`, `DELETE/PATCH /api/maintenance/employees/:id`
  - `GET /api/maintenance/notifications`
  - `GET/PUT /api/maintenance/settings`
  - `GET /api/maintenance/dashboard`
  - `POST /api/maintenance/cron/expiry-check`
- Admin routes require roles `admin` and/or `employee` (per item in appConfig).

## Conventions
- All CouchDB doc types prefixed `maintenance_*` (`maintenance_client`, `maintenance_job`, `maintenance_contract`, `maintenance_employee`, `maintenance_notification`).
- Doc IDs use `<type>:<id>` convention.
- Status enums are closed unions in `server/utils/types.ts` (`MaintenanceJobStatus`, `MaintenanceExpirationStatus`, `MaintenanceJobType`, `MaintenanceNotificationStatus`, `MaintenanceNotificationCategory`).
- Role gating: server-side via `assert-maintenance-role.ts`; client-side via `role-auth` middleware + `authAllowedRoles` on `definePageMeta`.
- Env config is read from CouchDB `_config` section `cf_env_maintenance` (see `server/utils/config.ts` — `readMaintenanceEnvConfig`), not from `runtimeConfig` env vars. Follow root AGENTS.md "Environment Configuration Standard".
- Notification dispatch goes through adapters in `notification-adapters.ts`; never call SMS/email layers directly.
- Email templates referenced by config keys (`emailTemplateCheck2y`, `emailTemplateOverhaul10y`, `emailTemplateGasSensorChange`).

## Dependencies
- Peer: `nuxt ^3.12.0 || ^4.0.0`.
- Extends layer: none declared in `nuxt.config.ts`, but imports `#database/utils/couchdb` (`bulkDocs`, `getAllDocs`, `getDocument`, `putDocument`, `validateCouchDBEnvironment`) and `#database/utils/couch-config` (`buildCouchEnvSection`, `readCouchConfigValues`). Consuming app MUST extend `layers/database`.
- Consuming app must register admin workspace + ui_navigation layers for sidebar sections to render.
- Implicit runtime expectations: an `auth` middleware, a `role-auth` middleware, and an `admin-workspace` layout must be provided by the app or another layer.

## Build / Test commands
No standalone lint/typecheck script. Unit specs are colocated (`*.spec.ts` / `*.test.ts` next to source). Run via root vitest config:

```bash
# from repo root
npx vitest run layers/maintenance
```

Typecheck/lint is performed inside a consuming app:

```bash
cd apps/gas-maintenance && nuxt typecheck
```

## Gotchas / Pitfalls
- `nuxt.config.ts` declares no `extends` for `database`, but code imports `#database/*` — the consuming app must include `layers/database` in its extends, otherwise alias resolution fails.
- Migration markers (`maintenance_meta:contract-model-migration-v1`, `maintenance_meta:client-expiration-model-v1`) run once on init; do not delete these docs from CouchDB or migrations re-run.
- Cron scheduler is started in `server/plugins/init.ts` via a `schedulerStarted` singleton flag — only safe in single-instance Nitro.
- Admin page role config is duplicated in both `adminWorkspace.sections` and `uiNavigation.sections` — keep them in sync when editing.
- `peerDependencies` allows Nuxt 3.12; but the layer is tested only under Nuxt 4.

## Cross-references
- Root: `/Users/radu/Projects/nuxt-apps/AGENTS.md`
- Layer docs: `docs/` (start with `2026-03-16T17-55-22Z-maintenance-layer-mvp-foundation.md`).
- Related layers: `layers/database`, `layers/email`, `layers/sms` (via notification adapters), `layers/admin_workspace`, `layers/ui_navigation`.
- Related skills: none specific.
