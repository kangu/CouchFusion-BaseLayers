# Fix inline font preview DataCloneError

## Request
When selecting a new font in `/k/` Typography (without clicking Apply), preview iframe should update instantly (e.g. selecting `Inter` should render `Inter`).

## Root cause
`builder_font_preview` messages from `InlineLiveEditor` could contain proxy-backed array values in `cssHrefs`, causing browser `postMessage` to throw `DataCloneError`.

## Changes
- Updated `content/app/components/inline/InlineLiveEditor.vue`:
  - added payload normalization helper for font preview payloads
  - ensured `cssHrefs` are plain cloned string arrays
  - reused normalized payload for storage and `postMessage`

## Verification
- Reproduced in browser automation at `http://localhost:3012/k/`.
- Changed Typography sans family to `Inter`.
- Confirmed iframe now receives live preview override and computes:
  - `--font-sans: 'Inter', sans-serif`
  - `body` and `h1` font family as `Inter`.
- No runtime page errors after patch.
