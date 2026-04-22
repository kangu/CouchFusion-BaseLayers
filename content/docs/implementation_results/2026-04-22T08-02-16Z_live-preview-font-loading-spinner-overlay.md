# Initial Prompt
Provide a loading spinner overlay for the moments where the font resources are loading

# Plan Followed
1. Track preview font loading state in `Workbench.vue` when live preview font selection changes.
2. Wait for selected font faces using the browser `document.fonts` API.
3. Show an overlay + spinner only over the preview area while fonts are loading.

# Implementation Summary
- Updated `layers/content/app/components/builder/Workbench.vue`:
  - Added reactive loading state:
    - `isPreviewFontLoading`
    - `waitForPreviewFonts()` with race-token guard to avoid stale updates
  - Watches selected preview font slugs and triggers font loading checks.
  - Updated preview template to include `builder-preview__surface` wrapper and conditional overlay.
  - Added spinner/overlay CSS:
    - `.builder-preview__loading`
    - `.builder-preview__spinner`
    - `@keyframes builderPreviewSpin`

Behavior:
- When user changes Sans/Display in Typography dropdowns, preview starts loading selected Bunny font faces.
- Overlay is displayed over preview while resources load, then disappears automatically.

# Verification Evidence
- Source-level verification in `Workbench.vue`:
  - overlay appears conditionally with `v-if="isPreviewFontLoading"`
  - loading state is toggled in `waitForPreviewFonts()` and guarded against race conditions.

# Proposed Next Steps
1. If desired, add a short delayed-show threshold (for example 120ms) to avoid spinner flicker on very fast cache hits.
