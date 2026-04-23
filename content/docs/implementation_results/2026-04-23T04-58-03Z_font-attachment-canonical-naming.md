# Font attachments: canonical naming and stable CSS URLs

## Change
- Simplified font attachment naming in `layers/content/server/utils/content-fonts.ts`:
  - removed hashed attachment suffixes.
  - attachment names now use deterministic standard format:
    - `<family>-<weight>-<style>-<stretch>-<subset>.woff2`
    - example: `montserrat-700-normal-100p-latin.woff2`

## Behavior
- On every **Apply Fonts**, active attachment binaries are overwritten under the same canonical names.
- Runtime CSS points to stable attachment URLs:
  - `/api/content/fonts/asset/<canonical-name>.woff2`
- Result: CSS URLs stay constant while serving the current binary content.

## Verification
- Ran:
  - `bunx vitest --config layers/content/vitest.fonts.config.ts --run layers/content/tests/server/font-assets.spec.ts`
- Result:
  - `1 passed`, `9 passed`.
