Implement a new `/builder` page in the bitvocation-demo app that enables inline editing for the currently active content page.

Progress:
- [x] Sidebar renders the shared `ContentAdminWorkbench` within a reusable inline editor shell housed in the content layer.
- [x] Preview iframe loads the live site URL and receives debounced document updates via `postMessage`, triggering in-place rerenders.
- [x] A Nuxt composable (`useContentLiveUpdates`) listens for `live_updates` events inside the app and applies incoming documents to the content store.
- [x] Save action continues to persist the edited document to CouchDB through the existing content store workflow.
- [x] Core functionality lives in the content layer for reuse, while the `/builder` page in the app provides layout and styling similar to `pages/admin/content.vue`.

See `inline_editor.png` for the visual layout reference.
