## Initial Prompt
Inside the AdminContentImageField component, integrate the current ImageKit Upload button into the Browse/Image Kit section next to the Search button.

## Plan
1. Remove the standalone Upload button from the top-level actions to avoid duplication.
2. Surface the ImageKit upload trigger inside the ImageKit library controls beside Search.
3. Keep local upload unchanged and ensure existing inputs still handle uploads.

## Implementation Summary
- Removed the separate Upload button from the inline actions bar.
- Added an Upload action to the ImageKit library controls (shown only when the ImageKit tab is active), sitting next to Search and using the existing ImageKit upload flow.
- Local upload controls remain under the Local tab; file inputs are unchanged.

## Next Steps
- Quick UI check: open the ImageKit tab, verify Search and Upload sit together and trigger the expected flows.
- If needed, adjust spacing so the added button aligns with the design system.
