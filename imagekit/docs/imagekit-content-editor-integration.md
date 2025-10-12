# ImageKit Content Editor Integration

## Initial Prompt
Let components use transformations at render time. Proceed with the plan.

## Implementation Summary
Implementation Summary: Enabled ImageKit-backed asset selection for the bitvocation content editor by wiring Nuxt runtime config, admin API routes, builder UI hooks, and the ContentImageField widget.

## Documentation Overview
- Hardened ImageKit type support by expanding `ImageKitFile`/list typings and aligning the `useImageKit` composable’s `getImageList` return signature for downstream widgets.
- Retained consistent response payloads across new admin API routes by reusing the ImageKit service helpers so uploads, deletes, and listings inherit common error handling.
- Provided shared helper utilities (`buildPreviewUrl`, folder hints) that the new field widget can rely on while still allowing per-field overrides via `ui` metadata.

## Implementation Examples
- Use the typed service in a Nitro route:
  ```ts
  const result = await imageKitService.listFiles({ limit: 20, path: 'content-editor' })
  if (!result.success) return { success: false, error: result.error }
  return { success: true, data: result.data }
  ```
- Consume the composable for library hydration inside a component:
  ```ts
  const { getImageList } = useImageKit()
  const assets = ref(await getImageList({ searchQuery: term.value }))
  ```
