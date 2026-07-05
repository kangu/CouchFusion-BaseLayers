# Builder Search Sticky Cleanup

## Summary
- Removed the leftover fixed editor header shell that previously held page-level save controls.
- Removed its sentinel, placeholder, measurement refs, resize/intersection observers, and fixed-header CSS.
- Kept locale status chips as a normal non-sticky row only when there is a real status to show.
- Refined `Search through content...` as the only sticky builder control:
  - sticky offset is now `5px`;
  - vertical separation uses margin around the search row;
  - search icon remains inside the input and is larger;
  - a pale blue background is applied only while the row is actually stuck.

## Verification
- Vue SFC compile check for `content/app/components/admin/ContentAdminWorkbench.vue` and `content/app/components/builder/Workbench.vue`.
- `bunx vitest --config vitest.config.ts content/tests/builder/page-picker-dialog.spec.ts content/tests/builder/focused-editor-mode.spec.ts --run`
- `bunx vitest --config vitest.config.ts content/tests/builder --run`
- Browser check on `http://localhost:3012/k/about` confirmed the old fixed header and sentinel are absent, the search sticks at `5px`, the icon is `22px` inside the field, and the stuck state applies the blue background.

## Notes
- Browser console still shows the existing Nuxt runtime-config warning for `content`; this was not introduced by this change.
