# Email Template Editor Replaced with CodeJar + Prism

## Request
Replace the MJML editor implementation on `layers/email/app/pages/admin/email-templates/[id].vue` from CodeMirror to a lighter `CodeJar + Prism` setup.

## What Changed
- Added a new reusable admin editor component:
  - `layers/email/app/components/admin/PrismCodeJar.vue`
- Refactored email template detail page:
  - Removed `vue-codemirror` usage and CodeMirror XML extension loading.
  - Replaced `<CodeMirror ... />` with `<PrismCodeJar v-model="editorState.mjml" />`.
  - Kept MJML compile/save/dynamic-text detection logic unchanged.
  - Updated scoped styles to target the new PrismCodeJar editor surface.
- Updated email layer peer dependencies:
  - Removed: `vue-codemirror`, `@codemirror/lang-xml`
  - Added: `codejar`, `prismjs`

## Outcome
- The MJML editor path in email template details now uses a lightweight syntax-highlighted editor stack (`CodeJar + Prism`) with minimal impact outside the email layer.
