# Local Image Library Integration

## Initial Prompt
```
Implement the specs in layers/content/docs/specs/local_image_upload.md. Proceed step by step with each section and mark that in the spec document as it's done to be used as reference when resuming work at a future time. 
Ask me for anything that after evalulation, you are not so sure what decision to make. Strive for minimal impact on other areas of the applicaiton. Any time your confidence for taking an actions is < 80%, ask for clarification.
```

## Implementation Summary
Implemented an auth-protected local image workflow: new content API routes handle listing/uploading/deleting files beneath `public/images`, ContentImageField toggles between ImageKit and local sources with upload/delete controls, and the spec now tracks completion with checklists.

## Documentation Overview
- Added `local-images` server endpoints (GET/POST/DELETE) that require the `auth` role, enumerate `public/images`, accept multipart uploads, and guard file access with path sanitisation.
- Extended `ContentImageField` with a "Browse Local" mode, inline source tabs, local upload/delete buttons, and unified library items for ImageKit versus local entries.
- Included helper utilities for filesystem operations (`server/utils/local-images.ts`) and updated the spec checklist to reflect the completed steps.

## Implementation Examples
```ts
const response = await requestFetch<LocalImageResponse>(
  '/api/content/local-images',
  {
    method: 'GET',
    params: { limit: requestedLimit, page: 1, search: searchTerm.value || undefined }
  }
)
```
```ts
const formData = new FormData()
formData.append('file', file, file.name)
await requestFetch('/api/content/local-images', { method: 'POST', body: formData })
```
```vue
<button
  type="button"
  class="image-field__button image-field__button--danger"
  @click="deleteLocalImage(item)"
  :disabled="localDeletePending === item.id"
>
  {{ localDeletePending === item.id ? 'Deleting…' : 'Delete' }}
</button>
```
