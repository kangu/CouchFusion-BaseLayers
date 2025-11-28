# Initial Prompt
Move the ContentDevErrorBoundary.vue file to the content layer components. Provide instructions inside the content layer docs for implementing this in other apps reusing the layer (when using <Content>).

# Implementation Summary
Implementation Summary: Moved ContentDevErrorBoundary into the content layer runtime components, exported it, updated Bitvocation to consume via relative path, and documented dev-only usage guidance for apps rendering <Content>.

# Documentation Overview
- Added `ContentDevErrorBoundary.vue` under `layers/content/app/components/runtime/` and exported it via the runtime index for easy imports when debugging content-rendering issues.
- Documented how consuming apps extending the content layer can wrap `<Content>` with the boundary to surface nested component errors in development without affecting production bundles.
- Clarified that the boundary is dev-only (`process.dev`) and meant to prevent Nuxt’s generic 500 page by showing inline error details with stack traces and a reset control.

# Implementation Examples
- Importing from an app extending the layer (relative path example when the app sits under `apps/<app>/app/pages`):
```ts
import ContentDevErrorBoundary from '../../../../layers/content/app/components/runtime/ContentDevErrorBoundary.vue'
```
- Usage around `<Content>` in a page/component:
```vue
<ContentDevErrorBoundary :context="route.path">
  <Content :value="pageDocument" />
</ContentDevErrorBoundary>
```
- Behaviour: In dev, child errors render an inline red panel with message/stack and a “Clear and retry” button; in production the boundary is inert and errors propagate as usual.
