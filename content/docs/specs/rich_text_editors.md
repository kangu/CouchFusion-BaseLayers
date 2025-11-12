# Rich Text Editors Specification

## Overview
- Integrate a rich text editor into the content builder with minimal bundle impact.
- Workflow expectations:
  1. Define a new `RichTextAreaString` type in `layers/content/app/types/fields.ts`.
  2. Ensure the CLI registry generator emits a `rich-string` UI widget for that type.
  3. Update `NodeEditor` to render the widget and persist valid HTML to CouchDB.
  4. Provide a frontend rendering plan that sanitizes the stored HTML (admin-authored but still validated).
- Libraries under consideration: **Tiptap**, **Quill**, **Draft.js**.

---

## Section 1 – Editor Evaluation ✅

- [x] Capture builder/runtime requirements.
- [x] Evaluate Tiptap and note pros/cons.
- [x] Evaluate Quill and note pros/cons.
- [x] Evaluate Draft.js and note pros/cons.
- [x] Lock final choice (Tiptap approved).

### Requirements Recap
- Vue 3 + TypeScript friendly, no React peer dependency.
- SSR-safe, optional lazy loading, and acceptable bundle size (<100 kB per editor instance after tree shaking).
- Extensible toolbar (bold/italic/links/headings) plus ability to expose sanitized HTML output.
- Minimal external/global dependencies; ideally ESM modules we can import directly in the layer.

### Library Evaluation

**Tiptap**
- Built on ProseMirror with first-party `@tiptap/vue-3` bindings; no DOM globals so it works in Nuxt SSR contexts.
- Modular packages (`@tiptap/core`, `@tiptap/starter-kit`, optional extensions) keep dependencies explicit; Starter Kit adds ~55 kB gzip, individual extensions can be tree-shaken to reduce size.
- Active community, extensible toolbar/keyboard shortcuts, supports HTML serialization out of the box.
- Requires adding a small set of packages but no peer frameworks. Editing surface is headless, letting us style controls to match the builder.
- Drawback: slightly steeper learning curve due to ProseMirror concepts, but still the most Nuxt-friendly option.

**Quill**
- Mature editor but ships as a large UMD bundle (~250 kB gzip) with its own theme CSS and a required global `document`, making SSR integration tricky.
- Vue wrappers exist but are unofficial and add extra dependencies; customizing toolbar/keyboard behaviour often requires touching Quill internals.
- Limited native TypeScript support; delta format would require extra conversion to HTML for storage, increasing complexity.

**Draft.js**
- React-specific API (depends on `React.Component`, hooks, etc.), so using it in a Vue-based builder would require a micro-frontend bridge or iframe.
- Bundle footprint is larger than Tiptap and still needs HTML conversion utilities.
- Facebook archived major development; maintenance cadence is slower than Tiptap.

### Recommendation (Pending Approval)
- Proceed with Tiptap as the primary implementation candidate: it satisfies SSR compatibility, modular dependencies, Vue 3 support, and HTML output requirements.
- Hold on final confirmation until the stakeholder signs off on adopting Tiptap.

---

## Section 2 – Schema & Registry Wiring ✅
- [x] Define `RichTextAreaString` alias in `layers/content/app/types/fields.ts`.
- [x] Extend `cli-content/generate-component-registry.mjs` to emit `ui.widget = 'rich-string'` and map to a custom component.
- [x] Update spec checklist once wiring is complete.

### Notes
- `RichTextAreaString` mirrors `TextAreaString` (plain `string`) but signals the registry generator to attach `{ widget: 'rich-string', component: 'ContentRichTextField' }`.
- Existing components only need to import the alias; running `bun cli-content/generate-component-registry.mjs --app=<name>` regenerates schemas with the new widget metadata.
- `determineControlType` treats the widget as text input so downstream builders keep string coercion while delegating UI concerns to the registered component.

## Section 3 – Builder Integration ✅
- [x] Implement a `ContentRichTextField` (Tiptap-powered) widget and register it in `register-builder.ts`.
- [x] Ensure `NodeEditor` handles the custom component for props and string arrays.
- [x] Document manual verification steps.

### Notes
- `ContentRichTextField.vue` wraps `@tiptap/vue-3` + `StarterKit`, exposing a minimal toolbar (bold, italic, strike, heading, bullets, ordered list, quote, code block) and debounced `modelValue` updates.
- Values are sanitized through `sanitizeRichTextHtml` before propagating to the store, so CouchDB always receives curated HTML.
- The widget auto-registers via `register-builder.ts`, making it available anywhere `ui.component = 'ContentRichTextField'` is emitted.
- NodeEditor already renders custom controls; no additional changes were required beyond the new component wiring.
- Manual verification:
  1. Run any consuming app with `npm run dev` (port 3000 by default).
  2. Open `/builder`, add a component with a `RichTextAreaString` prop, and confirm editing, toolbar toggles, and persistence.
  3. Inspect the saved document to ensure HTML is emitted/sanitized (no script/style tags).

## Section 4 – Runtime Rendering & Sanitization ✅
- [x] Provide a shared sanitizer helper and document usage prior to rendering admin-authored HTML.
- [x] Describe fallback behaviour for environments without DOM (SSR) to avoid flashes or unsafe output.

### Notes
- `app/utils/rich-text.ts` exports `sanitizeRichTextHtml`, powered by `dompurify` on the client. Server-side invocations fall back to returning the original value since builder writes are already sanitized before persistence.
- The helper enforces shared allowlists and appends `target="_blank"` + `rel="noopener noreferrer"` to anchors automatically.
- Host apps can import `sanitizeRichTextHtml` (or re-export it via their own utilities) before injecting HTML (e.g., `v-html="sanitizeRichTextHtml(props.body)"`).
- Since builder output is already sanitized before persistence, runtime sanitation becomes an idempotent safety net, and apps that need SSR sanitization can plug in their own server-only helpers if required.

## Section 5 – Documentation & Verification
- [x] Create/update layer docs summarizing the feature, usage examples, and verification steps.
- [x] Record implementation summary in `layers/content/docs/` per AGENTS guidelines.
