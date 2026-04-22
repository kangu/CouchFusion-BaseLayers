# Initial Prompt
I expect to see the Inter font applied when selecting Inter from the dropdown, but it doesn't. The previous rules from fonts.css still apply. They should be overwritten on the fly through the iframe.

# Plan Followed
1. Add a dedicated font-preview event from Workbench when sans/display dropdowns change.
2. Forward the event through `ContentAdminWorkbench` to `InlineLiveEditor`.
3. Post a new `builder_font_preview` message to the preview iframe.
4. In `useContentLiveUpdates` (inside iframe), dynamically load selected Bunny CSS and apply `:root` font variable overrides with `!important`.

# Implementation Summary
- Updated `layers/content/app/components/builder/Workbench.vue`:
  - Added new emit event: `font-preview-change`.
  - Emits payload on dropdown change with:
    - `sansFamily` label
    - `displayFamily` label
    - Bunny CSS href list

- Updated `layers/content/app/components/admin/ContentAdminWorkbench.vue`:
  - Added `font-preview-change` to emit typings.
  - Forwarded `@font-preview-change` from `BuilderWorkbench`.

- Updated `layers/content/app/components/inline/InlineLiveEditor.vue`:
  - Added iframe message path for `builder_font_preview`.
  - Added pending/replay logic so payload is resent after iframe load/ready handshake.

- Updated `layers/content/app/composables/useContentLiveUpdates.ts` (iframe side):
  - Added parser for `builder_font_preview` messages.
  - Injects/removes `<link data-inline-preview-font="1">` tags for current Bunny CSS URLs.
  - Applies inline override style block:
    - `:root { --font-sans: ... !important; --font-display: ... !important; }`
    - `html, body { font-family: var(--font-sans) !important; }`

Result:
- Unsaved dropdown changes now override `fonts.css` in iframe preview immediately.
- Apply workflow remains unchanged for persisted download/install.

# Verification Evidence
- Ran:
  - `cd layers && bunx vitest run content/tests/runtime/document.spec.ts --config vitest.config.ts`
- Result:
  - 1 file passed, 2 tests passed.

# Proposed Next Steps
1. In inline editor mode, switch sans/display repeatedly and confirm iframe updates instantly without clicking Apply.
2. If needed, add a tiny debounce to reduce rapid message churn while scrolling/selecting.
