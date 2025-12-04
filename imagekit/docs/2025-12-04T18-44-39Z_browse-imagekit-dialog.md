# Browse ImageKit Dialog – Hosted Video Selection

## Initial Prompt
Along with the upload functionality in Settings, bring in the Browse Imagekit dialog as well so I can choose a video or poster from an asset already uploaded.

## Implementation Summary
Added an ImageKit library picker to the Bitvocation settings dashboard section so admins can choose existing videos or posters; relies on the ImageKit list API and updated upload endpoint that accepts videos.

## Documentation Overview
- `layers/imagekit/server/api/imagekit/upload.post.ts` (already extended): Accepts image or video uploads (≤200MB) enabling hosted video assets to be managed from settings.
- Bitvocation settings use `useImageKit().getImageList` to browse ImageKit assets by folder (`videos`, `videos/posters`) and populate configuration fields.

## Implementation Examples
- Fetch library items for videos:
  ```ts
  const { getImageList } = useImageKit()
  const library = await getImageList({ limit: 50, path: 'videos' })
  const videos = library.files.filter((item) => (item.fileType || '').startsWith('video/'))
  ```
- Upload a new poster (still supported):
  ```bash
  curl -X POST -F "file=@poster.jpg" -F "folder=videos/posters" http://localhost:3012/api/imagekit/upload
  ```
