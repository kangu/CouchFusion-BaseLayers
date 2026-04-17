# Global Alias Editing UX Restoration (Editor + Live Preview)

## Problem
After centralizing global alias persistence, editing alias props no longer behaved like regular components:
- prop edits did not reliably appear as local editor state changes,
- inline live preview did not reflect edits consistently,
- persistence behavior felt broken.

## Root causes
1. `updateNodeProp` stopped mutating `node.props` for alias nodes.
   - Node editor UI relies on local node props as immediate reactive source.
2. Alias prop stripping was applied to both saved and preview documents.
   - Live iframe preview receives `document-preview-change`; stripping there removed edited values before the iframe could render them.

## Fix
In `Workbench.vue`:
- For alias nodes, `updateNodeProp` now updates `node.props` locally (same UX as regular components) **and** queues central global-registry persistence.
- Kept global central persistence path (debounced admin save) unchanged.
- Kept alias prop stripping for persisted `document-change` path.
- Removed alias prop stripping from `previewDocument` serialization path so live preview keeps immediate edited values.

## Resulting behavior
- Editing global alias props feels like normal component editing in the builder.
- Live preview updates immediately during editing.
- Persisted page documents remain reference-only for global alias props.
- Global alias defaults continue to persist centrally.

## Validation
- `apps/nuxt-app-starter`: `npx nuxi prepare` passed.

## Files changed
- `layers/content/app/components/builder/Workbench.vue`
