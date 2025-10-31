# Guide for Authoring Valid Content Components

This note captures the conventions used across `components/content` so component authors—and future LLM-assisted generators—can publish Vue files that integrate smoothly with the content builder, live preview, and persisted documents.

## Component Shape
- Export `<script setup lang="ts">` and stay SSR-friendly. Avoid browser-only APIs outside `onMounted` guards.
- Default `inheritAttrs` behaviour is fine; only disable it if you deliberately proxy attrs elsewhere. Most builder bindings arrive as standard props/attrs.
- Accept `props` via `defineProps` with a TypeScript interface. Make every value optional unless absolutely required. Provide reasonable defaults inside `withDefaults`.
- When a prop may arrive as a JSON string (e.g., arrays emitted via `:prop="[...]"`), coerce it before rendering:
  ```ts
  const coerceArray = (value: unknown) => {
    if (Array.isArray(value)) return value
    if (typeof value === 'string') {
      try { return JSON.parse(value) } catch { return [] }
    }
    return []
  }
  const items = computed(() => coerceArray(props.items) ?? fallback)
  ```
- Support colon-prefixed bindings (`attrs[':prop']`) when the builder renders the component through dynamic markup. Use `useAttrs()` to inspect raw attributes when necessary.
- Return fallback data when all coercion attempts fail to keep the UI meaningful during authoring.

## Template Expectations
- Wrap content in semantic containers; avoid root fragments that complicate hydration.
- Loop over arrays with a stable `:key`. Prefer a natural identifier (`id`, `label`) and fall back to the index only when unavoidable.
- Always guard optional data with `v-if` to prevent rendering `undefined` strings or icons without labels.
- Slot support:
  - Expose slot hints in the component registry via `allowChildren` or `childHint` if the component renders `<slot>` entries.
  - If custom slots exist, name them explicitly (`<slot name="footer" />`) so the builder can manage them.

## Reactivity & State
- Use `computed` for derived view data. Avoid mutating props; clone before manipulation if required.
- Leverage `watch` only when the component performs side effects (e.g., rebuilding a canvas). Always clean up listeners in `onBeforeUnmount`.
- Respect `prefers-reduced-motion` and other accessibility signals when animating.

## Props for Builder Integration
- Keep prop names kebab-case when declared in the template, camelCase in TypeScript.
- For array/object props:
  - Model them as `jsonarray`/`jsonobject` in the registry.
  - Provide shape documentation (e.g., `{ icon: string; label: string }`) via TypeScript types and comments.
  - On ingest, validate each entry before rendering.
- For numeric props encoded as strings (common in builder forms), coerce using `Number()` and fall back gracefully.

## Error Handling Patterns
- Fail closed: if critical data is missing, render nothing for that subsection rather than throwing.
- When integrating third-party libs (canvas, charts), feature-detect APIs and guard SSR contexts (`if (process.client)` or `typeof window !== 'undefined'`).

## Content Builder Registry Alignment
- After creating or editing a component, re-run the registry generator (`bun cli-content/generate-component-registry.mjs --app=<name>`) to refresh prop metadata.
- Ensure defaults defined in Vue match the generated registry defaults so seeded docs stay consistent.
- Document any coercion logic in `/docs` so future contributors understand why props behave leniently.

## Testing & Preview Tips
- Load the component via the inline content builder to confirm reactive updates.
- Inspect the persisted CouchDB document to verify props store as valid JSON, not colon-prefixed strings.
- When adding animation or event listeners, test both desktop and mobile interactions; ensure listeners are removed on unmount.

Following these best practices keeps content components resilient, minimizes drift between builder data and runtime rendering, and helps automated tooling generate valid, reactive Vue output.
