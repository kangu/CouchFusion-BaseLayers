# ImageKit Layer TypeScript Migration

## Initial Prompt
We are building a new reusable layer called "imagekit". Read the specs from layers/imagekit/docs/layer_spec.md. Ask me for anything that after evalulation, you are not so sure what decision to make. Strive for minimal impact on other areas of the applicaiton. Any time your confidence for taking an actions is < 80%, ask for clarification. Present implementation plan before proceeding on my instructions.

## Implementation Summary
Implementation Summary: Added ImageKit layer Nuxt config and init plugin for env validation, migrated server utility and composable to TypeScript, and documented configuration requirements.

## Documentation Overview
- Added `layers/imagekit/nuxt.config.ts` to expose the layer alias, enforce strict TypeScript, and surface runtime configuration sourced from `IMAGEKIT_*` environment variables.
- Introduced `layers/imagekit/server/plugins/init.ts` to validate required ImageKit environment variables during Nitro startup and provide actionable error messaging.
- Migrated the ImageKit SDK wrapper to `layers/imagekit/utils/imagekit.ts`, delivering typed responses, reusable transformation helpers, and graceful handling when configuration is missing.
- Rebuilt the client composable as `layers/imagekit/composables/useImageKit.ts`, supplying typed state, shared helper signatures, and consistent API error propagation for uploads, URL generation, listing, and deletion flows.

## Implementation Examples
- Server utilities can now import the typed singleton via:
  ```ts
  import { imageKitService } from '#imagekit/utils/imagekit'

  export default defineEventHandler(async (event) => {
    const body = await readBody<{ file: string; name: string }>(event)
    const result = await imageKitService.uploadFile(body.file, body.name)
    return result
  })
  ```
- Client components may consume the typed composable directly:
  ```ts
  const { uploadImage, uploadedImages, isUploading, error } = useImageKit()

  const onFileSelected = async (file: File) => {
    await uploadImage(file, { folder: 'marketing-assets' })
    console.log(uploadedImages.value)
  }
  ```
