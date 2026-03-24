# ImageKit API Role Access: Admin, Curator, Organizer

## Scope
- Layer: `layers/imagekit`
- Endpoints under: `server/api/imagekit`

## Change
- Added a new ImageKit-specific access guard:
  - `server/utils/assert-imagekit-session.ts`
- This guard allows authenticated users with any of these roles:
  - `admin`
  - `curator`
  - `organizer`

## Applied To
- `server/api/imagekit/upload.post.ts`
- `server/api/imagekit/files.get.ts`
- `server/api/imagekit/files/[fileId].delete.ts`
- `server/api/imagekit/generate-url.post.ts`

## Notes
- Shared `assertAdminSession` behavior remains unchanged.
- Unauthorized role access still returns `404 Not found` to preserve previous API response semantics.
