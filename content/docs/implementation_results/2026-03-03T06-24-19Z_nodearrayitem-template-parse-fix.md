# NodeArrayItem Template Parse Fix (`Whitespace was expected`)

## Context
- App runtime: `/Users/radu/Projects/indux/admin-backend/kktor-indux/frontends/indux`
- Layer source file: `/Users/radu/Projects/nuxt-apps/layers/content/app/components/builder/node-editor/NodeArrayItem.vue`
- Error observed in browser/console: `Pre-transform error: Whitespace was expected` and 500 at the layer file path.

## Root cause
The template used nullish coalescing (`??`) directly inside two `:transform-value` directive expressions. In the current compiler/tooling stack used by the app, those template expressions failed to parse and surfaced as a pre-transform Vue template error.

## Changes made
- Replaced the two inline `??` template expressions with a helper call:
  - Added `getImageKitTransformValue(value, fieldKey)` in `<script setup>`.
  - Updated both problematic bindings to call this helper.
- File updated:
  - `/Users/radu/Projects/nuxt-apps/layers/content/app/components/builder/node-editor/NodeArrayItem.vue`

## Validation
- Ran `@vue/compiler-sfc` parse/compile check from the `indux` app environment against the layer file.
- Result: `ok` (no template parse errors).
