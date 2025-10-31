## Textarea Prop Support via `TextAreaString`

### Summary
- Introduced a `TextAreaString` type alias (`layers/content/app/types/fields.ts`).
- `cli-content/generate-component-registry.mjs` now detects this alias and emits `ui.widget = 'textarea'` for the generated schema.
- Any component prop typed as `TextAreaString` continues to serialize as a string but renders with a multiline textarea in the content builder.

### Usage
```ts
import type { TextAreaString } from '#content/app/types/fields'

const props = withDefaults(defineProps<{
  quickStartCommand?: TextAreaString
}>(), {
  quickStartCommand: 'echo "Multi-line\ncommand"'
})
```

### Implementation Notes
- The generator checks for the type reference name `TextAreaString`; no additional metadata is required.
- If a component omits the alias, the prop defaults to the single-line text field.
- Runtime coercion remains the same—values are still plain strings stored in CouchDB.

### Action Items
- Use `TextAreaString` for any field that should allow multi-line editing in the builder (commands, descriptions, YAML snippets, etc.).
- Re-run `bun cli-content/generate-component-registry.mjs --app=<name>` after updating components so the registry reflects the textarea widget.
