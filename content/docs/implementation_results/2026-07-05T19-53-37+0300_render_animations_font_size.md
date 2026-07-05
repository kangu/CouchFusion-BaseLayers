# Render Animations Font Size

## Summary
- Removed the Actions-menu toggle label font-size override that made `Render Animations` smaller than neighboring menu actions.
- The label now inherits the same font size, weight, and interaction states as the rest of the Actions dropdown items.
- Added a source assertion to prevent reintroducing the smaller toggle-label selector.

## Verification
- Vue SFC compile check for `content/app/components/admin/ContentAdminWorkbench.vue`.
- `bunx vitest --config vitest.config.ts content/tests/builder/page-picker-dialog.spec.ts --run`
- `bunx vitest --config vitest.config.ts content/tests/builder --run`
- Browser check on `http://localhost:3012/k/about` confirmed `Render Animations` and the other Actions items all compute to `13.76px` and font weight `700`.

## Notes
- Browser console still shows the existing Nuxt runtime-config warning for `content`; this was not introduced by this change.
