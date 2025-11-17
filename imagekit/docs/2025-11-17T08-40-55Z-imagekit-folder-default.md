## Initial Prompt
I want to update the imagekit layer to include a NUXT_IMAGEKIT_FOLDER (optional) .env variable. When set, it should be the default "folder" parameter when browsing and uploading files through the imagekit dialog. If "folder" is set on one of the requests, that should override the supplied default. Propose a plan for implementation and let me review it

## Implementation Summary
Implementation Summary: Added optional NUXT_IMAGEKIT_FOLDER defaulting ImageKit dialog browse/upload requests to the configured folder while allowing explicit request folders to override it across runtime config, UI, and API handlers.

## Documentation Overview
- New optional `NUXT_IMAGEKIT_FOLDER` env is surfaced as `runtimeConfig.imagekit.folder` and `runtimeConfig.public.imagekit.folder` to inform both server handlers and client dialogs.
- Content/image dialogs now prefer `folder` from field UI config, then the configured default folder, and finally fall back to `content-editor`, ensuring request-specific folders still win.
- ImageKit API handlers default their `folder`/`path` to the configured folder when none is provided, keeping browse and upload endpoints aligned with the new configuration.

## Implementation Examples
- Runtime config exposure with optional folder: `layers/imagekit/nuxt.config.ts`.
- Dialog default folder resolution: `layers/content/app/components/admin/ContentImageField.vue` (`folderHint` computed uses runtime config folder when present).
- API fallback to configured folder: `apps/bitvocation-demo/server/api/imagekit/upload.post.ts` and `apps/bitvocation-demo/server/api/imagekit/files.get.ts` normalize request folders and apply the configured default when missing.
