# Content Middleware Route Filter

## Initial Prompt
Proceed with the implementation. Make sure to document every isContentRoute condition so it can be reviewed later

## Implementation Summary
Added route filtering guard to content middleware to skip reserved prefixes, query/hash, and extension segments so only real content pages trigger fetches.

## Documentation Overview
- The middleware now uses a dedicated `isContentRoute` helper that validates paths start with `/`, are not reserved admin/system prefixes, omit query/hash fragments, and do not end with file extensions.
- Each rule inside the helper includes inline comments describing why the condition exists, serving as reviewer-ready documentation.
- Requests bypassing the helper no longer log fetch attempts or hit CouchDB, keeping noise down for `/.well-known`, favicon, and static asset probes during development tools sessions.

## Implementation Examples
- `layers/content/middleware/content.global.ts:5` – documents the reserved prefix list and route guard logic used before invoking `fetchPage`.
