# Testing Plan – Seed Fixtures

## Initial Prompt
```
Flesh out layer-specific seed helpers (content fixtures, auth users) leveraging the
     harness API
```

## Implementation Summary
Implementation Summary: Added reusable content and auth fixture helpers under layers/_tests/fixtures to build page documents, optional history snapshots, and role-based CouchDB users for upcoming tests.

## Documentation Overview
- Created `layers/_tests/fixtures/content.ts` with `buildContentPageDocument`, `buildPageHistoryDocument`, and `seedContentPages` helpers that wrap the shared harness.
- Added `layers/_tests/fixtures/auth.ts` exposing `seedAdminUser`, `seedAuthorUser`, and `seedUserWithRoles` for generating CouchDB users with AuthSession cookies.
- Updated `docs/testing/couchdb-test-harness.md` and the testing plan (`layers/content/docs/specs/testing_plan.md`) to reference the new fixture utilities.

## Implementation Examples
- `layers/_tests/fixtures/content.ts:1` – constructs seeded page docs and optional history records consumed by the harness.
- `layers/_tests/fixtures/auth.ts:1` – convenience helpers for creating admin/author users during tests.
