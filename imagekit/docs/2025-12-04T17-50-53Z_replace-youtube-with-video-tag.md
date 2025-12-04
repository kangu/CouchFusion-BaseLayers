# Replace YouTube With Hosted Video (ImageKit Layer)

## Initial Prompt
Implement the specs in `docs/specs/replace_youtube_with_video_tag.md`. Proceed step by step with each section and mark that in the spec document as it's done to be used as reference when resuming work at a future time. Ask me for anything that after evalulation, you are not so sure what decision to make. Strive for minimal impact on other areas of the applicaiton. Any time your confidence for taking an actions is < 90%, ask for clarification. Present implementation plan before proceeding on my instructions.

## Implementation Summary
Replaced the dashboard YouTube embed with a HostedVideo component backed by ImageKit mp4/poster defaults, added admin settings upload controls via the ImageKit API, and extended site-config plus content builder entries to support hosted video while keeping legacy videoId data.

## Documentation Overview
- Updated `server/api/imagekit/upload.post.ts` to allow video uploads alongside images (up to 200MB) so hosted dashboard videos can be uploaded via settings.
- Dashboard video defaults now rely on ImageKit-hosted assets, leveraging the layer’s URL resolution utilities in `HostedVideo.vue`.

## Implementation Examples
- Accept video uploads via the ImageKit API:
  ```bash
  curl -X POST -F "file=@/path/to/video.mp4" -F "folder=videos" \
    http://localhost:3012/api/imagekit/upload
  ```
- Resolve ImageKit URLs in Vue:
  ```ts
  import { resolveImageKitUrl } from '#imagekit/utils/transform'

  const videoUrl = resolveImageKitUrl('/videos/pow-lab-overview.mp4', runtimeConfig.public.imagekit.urlEndpoint)
  ```
