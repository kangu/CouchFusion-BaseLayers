# Self-hosted analytics engine — spec preparation

## Initial prompt
Start a new analytics layer reaching feature parity with Fathom (usefathom/fathom) and Umami, integrated into CouchFusion apps through an admin module.
Decisions: evolve `layers/analytics` (A1), CouchDB-only storage, admin on `admin_workspace`, pilot `apps/kangu`, deliverable = spec.

## Plan followed
1. Scanned `layers/analytics`, `layers/admin_workspace`, `layers/auth`, `layers/database`, `layers/content` admin pages, and `apps/kangu` config.
2. Mapped Fathom Lite and Umami features into a parity matrix, assigned to phases P0–P4.
3. Designed the CouchDB storage, ingestion, aggregation, query, API, and admin module, keeping today's `umami_cloud` behaviour as the default.

## Summary
- Spec: `docs/specs/2026-10-09T19-47-30Z-self-hosted-analytics-spec.md`
- No code changes.
- Key findings:
  - `layers/analytics` is today a stateless Umami Cloud proxy used by 13 apps.
  - Kangu does not extend `admin_workspace`, even though the content layer's `/admin/pages` already asks for the `admin-workspace` layout.

## Next steps
- Open questions resolved 2026-10-09 (spec §1 Q1–Q7).
- Then start P0: add the `analytics_mode` pipeline refactor behind the unchanged `/api/stats`, and add `admin_workspace` to kangu.
