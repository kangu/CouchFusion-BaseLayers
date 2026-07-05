# Render Animations Toggle

## Summary
- Renamed the Actions dropdown control from `Keep Animations Running` to `Render Animations`.
- Replaced the previous text On/Off affordance with the same pill switch styling used by the Translations menu `Inline translations` toggle.
- Scoped the Actions toggle label styling so it does not leak onto the shared switch element.

## Verification
- Vue SFC compile check for `content/app/components/admin/ContentAdminWorkbench.vue`.
- `bunx vitest --config vitest.config.ts content/tests/builder/page-picker-dialog.spec.ts --run`
- `bunx vitest --config vitest.config.ts content/tests/builder --run`
- Browser check on `http://localhost:3012/k/about` confirmed the Actions dropdown contains `Render Animations`, does not contain the old label, and renders the shared switch class.

## Notes
- Browser console still shows the existing Nuxt runtime-config warning for `content`; this was not introduced by this change.
