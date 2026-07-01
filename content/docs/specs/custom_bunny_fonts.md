# Custom Bunny Fonts

## Goal
Update the Typography section of the content editor so font dropdowns can install new Bunny Fonts on demand, then use downloaded fonts as selectable editor/runtime options.

## Implementation Checklist

- [x] **Section 1: Server catalog and installed-font model**
  - Fetch Bunny Fonts catalog from `https://fonts.bunny.net/list`.
  - Normalize catalog entries into stable `{ slug, label, category, styles, weights, variants, isVariable }` records.
  - Track installed font families in the existing CouchDB font assets document.
  - Use installed/downloaded fonts as the primary dropdown source instead of the `_config` allowlist.
  - Keep `_config` allowlist/defaults only as backward-compatible seed/default fallback.

- [x] **Section 2: Install current typography profile only**
  - Add an admin install endpoint for one selected Bunny family.
  - Download and persist only the currently selected typography profile: selected styles, weights, and widths.
  - Store downloaded binaries as existing CouchDB font attachments.
  - Record installed family metadata so the font appears in future dropdowns.

- [x] **Section 3: Typography dropdown and modal UI**
  - Add a final `Add new...` option to the Sans and Display font dropdowns.
  - Open a modal when that option is selected.
  - Provide a professional font-browser layout with search, metadata, and rendered previews.
  - Lazy-load/queue preview CSS so the dialog does not load too many font files at once.
  - After install, select the new font in the dropdown that triggered the modal.

- [x] **Section 4: Validation on Bitvocation**
  - [x] Run focused content-layer font tests.
  - [x] Verify the running Bitvocation server recognizes the new font endpoints on `localhost:3012`.
  - [x] Complete authenticated editor click-through once an active admin session/token is available.
  - [x] Persist an implementation summary in the Bitvocation project.

## Original Request
I want to update the Typography section of the content editor to allow for the Fonts dropdown a new final option "Add new...".

The link would open a modal window for browsing the available fonts on the bunny.net infrastructure. Make sure to provide renderings of the fonts on that dialog like in a professional font manager.

Carefully consider performance and try to lazy-load or queue requests if there are too many to load.

When a font is selected, it is downloaded and stored in the existing couchdb infrastructure so it can be applied like any of the other builtin fonts.

Font list should not come from the config env anymore, it should be free to use any downloaded fonts.

## Clarification
Installing a font downloads only the current typography profile selected in the editor: selected styles, weights, and widths.
