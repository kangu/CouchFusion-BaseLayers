# NodeObjectField Template Parse Fix (`Whitespace was expected` / pre-transform)

## Context
- Runtime route tested: `http://localhost:3000/fokus/deko`
- App: `/Users/radu/Projects/indux/admin-backend/kktor-indux/frontends/indux`
- Layer file: `/Users/radu/Projects/nuxt-apps/layers/content/app/components/builder/node-editor/NodeObjectField.vue`

## Root cause
`NodeObjectField.vue` had `:transform-value` template expressions with inline nullish coalescing (`??`). In this compiler/tooling stack, those expressions failed parsing during Vue pre-transform.

## Changes made
- Replaced inline template `??` usage in two `:transform-value` bindings with helper calls.
- Added helper in script setup:
  - `getImageKitTransformValue(value, fieldKey)`
- This preserves behavior while avoiding template parser incompatibility.

## Validation
- `@vue/compiler-sfc` parse/compile check for both:
  - `NodeArrayItem.vue`
  - `NodeObjectField.vue`
- Route render check via Playwright:
  - `http://localhost:3000/fokus/deko` renders with title `InduX - DEKO` (no 500).
