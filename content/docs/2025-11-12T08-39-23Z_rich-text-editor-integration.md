# Rich Text Editor Integration

## Initial Prompt
```
Implement the specs in layers/content/docs/specs/rich_text_editors.md. Proceed step by step with each section and mark that in the spec document as it's done to be used as reference when resuming work at a future time. 
Ask me for anything that after evalulation, you are not so sure what decision to make. Strive for minimal impact on other areas of the applicaiton. Any time your confidence for taking an actions is < 80%, ask for clarification. Present implementation plan before proceeding on my instructions.
```

## Implementation Summary
Added `RichTextAreaString`, a Tiptap-powered `ContentRichTextField`, shared sanitization helpers, registry wiring, and docs so builder components can persist and safely render rich text content end to end.

## Documentation Overview
- `layers/content/app/types/fields.ts` now exports `RichTextAreaString`, which the CLI generator detects to emit `ui.widget = 'rich-string'` and `ui.component = 'ContentRichTextField'`.
- `layers/content/app/components/admin/ContentRichTextField.vue` wraps `@tiptap/vue-3` + StarterKit with a minimal toolbar, debounced updates, and sanitization via `sanitizeRichTextHtml`.
- `layers/content/app/utils/rich-text.ts` centralizes the sanitizer (powered by `dompurify` in the client and passthrough on SSR) so both builder and runtime callers can reuse the same allowlist.
- `layers/content/app/plugins/register-builder.ts` registers the new component globally, so auto-generated schemas start working immediately after rerunning the registry script.
- `layers/content/docs/specs/rich_text_editors.md` tracks the completed sections plus verification guidance.

## Implementation Examples
```ts
// Component prop schema inside an app component
import type { RichTextAreaString } from '#content/app/types/fields'

const props = defineProps<{ body: RichTextAreaString }>()
```
```ts
// Runtime usage when rendering HTML
import { sanitizeRichTextHtml } from '#content/app/utils/rich-text'

const safeHtml = computed(() => sanitizeRichTextHtml(props.body))
```
```bash
# Regenerate registry entries after adopting the new type
bun cli-content/generate-component-registry.mjs --app=my-app
```
