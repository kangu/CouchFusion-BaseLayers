## Initial Prompt
Migrate the code that sits in the bitvocation-demo app to the imagekit layer

## Implementation Summary
Added shared ImageKit admin endpoints (upload, browse/list with delete, generate-url) into the imagekit layer guarded by the auth admin session, reusing default folder handling so consuming apps can call `/api/imagekit/*` without app-local copies.

## Documentation Overview
- New server API routes live in `layers/imagekit/server/api/imagekit/` to support uploads, listings (with delete), and URL generation using the shared `imageKitService` and the auth layer’s `assertAdminSession`.
- Folder defaults honor `runtimeConfig.imagekit.folder`/`public.imagekit.folder`, while respecting per-request overrides, matching previous behavior migrated from bitvocation-demo.
- Responses retain no-cache headers for listing, size/type enforcement for uploads, and consistent success/error shapes expected by `useImageKit` and the content admin dialog.

## Implementation Examples
- Upload handler with default-folder fallback and validation: `layers/imagekit/server/api/imagekit/upload.post.ts`.
- Browse/list with overrideable path and no-cache headers: `layers/imagekit/server/api/imagekit/files.get.ts`.
- Delete and URL generation endpoints exposed to clients: `layers/imagekit/server/api/imagekit/files/[fileId].delete.ts`, `layers/imagekit/server/api/imagekit/generate-url.post.ts`.
