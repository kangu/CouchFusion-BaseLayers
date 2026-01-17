## Initial Prompt
I get a hydration error [Vue warn]: Hydration node mismatch:
- rendered on server: <div class="space-y-1">…</div>
- expected on client: p

## Implementation Summary
Implementation Summary: Made the configured-host banner conditional on the client flag to prevent SSR/client mismatch when localStorage values hydrate.

## Documentation Overview
- The Data Sync banner now waits for the client mount before rendering credential-dependent UI.

## Implementation Examples
```ts
const hasCredentials = computed(() => isClient.value && Boolean(host) && Boolean(username) && Boolean(password))
```
