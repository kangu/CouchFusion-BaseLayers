# Email Template Prism/CodeJar Load Fix

## Issue
`/admin/email-templates/welcome_to_pow_lab` rendered without a working MJML editor after switching to CodeJar + Prism.

## Root Cause
Two regressions in the new editor wiring:
1. Wrong auto-import component tag in page template (`PrismCodeJar` instead of `AdminPrismCodeJar`) caused unresolved component and empty editor area.
2. Prism module interop mismatch caused runtime import failure / missing Prism APIs, preventing editor init and later preventing highlighting.

## Fixes Applied
- Updated page usage to the correct auto-imported component name:
  - `layers/email/app/pages/admin/email-templates/[id].vue`
  - `<AdminPrismCodeJar v-model="editorState.mjml" />`
- Updated Prism integration in editor component:
  - `layers/email/app/components/admin/PrismCodeJar.vue`
  - Use side-effect import `import 'prismjs'` and resolve Prism from `globalThis.Prism`.
  - Guard for missing Prism/highlight/language and fallback to plain text rendering if unavailable.

## Verification
- Route loads successfully with editor visible.
- Editor content loads (`textLen` > 13k chars).
- Syntax highlighting active (`.token` elements present, token count observed: 794).
- No Prism/module initialization errors remain.
