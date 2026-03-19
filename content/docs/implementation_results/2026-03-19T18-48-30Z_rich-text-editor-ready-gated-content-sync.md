# Rich Text Editor Ready-Gated Content Sync

## Request
The ProseMirror/Tiptap rich-text field was malfunctioning and needed to ensure content is loaded only when the editor is ready.

## What Changed
- Updated `layers/content/app/components/admin/ContentRichTextField.vue`.
- Added `pendingExternalContent` to queue incoming `modelValue` HTML while the editor instance is not initialized.
- Made the `modelValue` watcher immediate so initial external content is captured on mount.
- Updated `syncExternalValue` to:
  - store sanitized content in the pending queue when editor is unavailable,
  - apply content directly when editor exists,
  - clear queue after successful sync.
- Added `onCreate` handler in Tiptap editor init to apply any queued content once editor is fully ready.

## Outcome
- Initial and early external HTML values are now reliably applied when the ProseMirror editor finishes creating.
- Reduces race conditions where content could appear empty/stale during lazy-loaded editor startup.
