# History Button Always Visible Next to Save

## Scope
- File: `layers/content/app/components/admin/ContentAdminWorkbench.vue`
- Goal: keep `History` always visible directly next to `Save`, while preserving the Save side-menu for secondary actions.

## Implemented
- Added a persistent `History` button in the save split group, immediately after `Save Changes`.
- Wired the button to the existing `toggleHistoryMenu` handler.
- Removed `History` from the Save actions dropdown to avoid duplicate entry points.
- Kept the previous low-impact event handling fix where outside-menu close uses `pointerdown`.

## Runtime Impact
- No new watchers/composables/stores.
- Only template wiring and existing handler reuse; negligible production runtime impact.

## Verification
- Manual local render check at `http://localhost:6018/` confirms app loads.
- Direct `/k/` route currently returns `404 Content page not found`, so the exact prior `/k/` interaction path was not reproducible in this run.
- Static verification confirms header action markup now places `History` adjacent to `Save` and removes it from the side menu.
