# CouchFusion Theme Schema Profile

## Problem
The node editor Theme panel for CouchFusion pages showed stale Bitvocation labels such as `Orange Custom` and `Orange Custom Hover`, and the Simple theme fields were empty.

## Root Cause
`server/utils/content-theme.ts` defined one shared Simple-theme token set with Bitvocation-specific labels. CouchFusion did not have its own theme profile, so the schema still exposed Bitvocation-era token names while the preset lookup returned no CouchFusion defaults.

## Implementation
- Added app-aware theme profile resolution for `cfcom` and `couchfusioncom` slugs.
- Added CouchFusion default theme values for primary, secondary, background, foreground, and radius.
- Added CouchFusion-specific Simple theme labels: `CouchFusion Green`, `Bitcoin Orange`, `Paper Background`, `Ink Foreground`, and `Radius`.
- Preserved Bitvocation as the default/fallback profile so existing projects keep their current Theme panel labels.
- Added tests that prove CouchFusion profile defaults and labels do not expose the stale Bitvocation artifacts.

## Verification
- Passed targeted theme tests with a no-setup Vitest config because the normal layer setup attempts a CouchDB connection in this sandbox.
- Passed `node --test apps/couchfusioncom/tests/*.test.mjs`.
- Passed `bunx nuxi prepare` in `apps/couchfusioncom`.

## Notes
The standard layer Vitest command is still blocked in this sandbox by the CouchDB test setup. Direct probes to both `http://localhost:5984/` and `http://127.0.0.1:5984/` fail from this session. Re-running the standard layer spec with `COUCHDB_URL=http://localhost:5984` still fails because Node resolves `localhost` to `::1` and `127.0.0.1`, and both connection attempts receive `EPERM`. The targeted test file itself passes when isolated from that environment setup.
