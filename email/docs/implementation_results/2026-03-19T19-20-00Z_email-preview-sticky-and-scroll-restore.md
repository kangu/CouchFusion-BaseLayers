# Email Preview Sticky Position + Scroll Restoration

## Request
Keep the HTML preview anchored at the top while scrolling the page, and preserve preview scroll position when MJML changes trigger HTML preview reloads.

## Root Cause
The preview iframe uses `srcdoc`. Every HTML recompilation reloads the iframe document, resetting internal scroll to top.

## Changes
Updated `layers/email/app/pages/admin/email-templates/[id].vue`:

- Added preview iframe ref + scroll restore state:
  - `previewIframeRef`
  - `pendingPreviewScrollRestore`
- Added lifecycle helpers:
  - `capturePreviewScrollPosition()` before assigning new `editorState.html`
  - `restorePreviewScrollPosition()` on iframe `load` (double `requestAnimationFrame`)
- Hooked iframe load event:
  - `@load="onPreviewIframeLoad"`
- Kept preview section anchored with sticky fit sizing:
  - added `lg:h-fit` to preview section.
- Enabled iframe same-origin access required for scroll read/restore:
  - changed sandbox to `allow-scripts allow-same-origin`.

## Verification
Playwright verification on `/admin/email-templates/welcome_to_pow_lab`:
- Scrolled preview iframe to `y=653`.
- Triggered preview refresh via detected-text input edit.
- Post-refresh preview scroll remained at `y=653` (`delta=0`).
