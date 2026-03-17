# Runtime bound-prop empty JSON guard

## Context
On the main route, runtime rendering warned with:
- `Failed to parse bound prop JSON: principles Unexpected end of JSON input`
- Nuxt dev warning about log stringify (`DevalueError: Cannot stringify arbitrary non-POJOs`)

The content body included empty bound JSON entries such as `":principles": ""`.

## Changes
File updated:
- `layers/content/app/components/runtime/content/Content.vue`

What was changed in `normalizeProps`:
1. Added `isLikelyJsonString()` plus `JSON_NUMBER_PATTERN` to avoid attempting `JSON.parse` on values that are clearly not JSON payloads.
2. Added an explicit guard for empty/undefined string values:
   - when bound prop value is `""`, whitespace-only, or `"undefined"`, the bound prop is dropped (no parse attempt, no warning).
3. Suppressed warnings for incomplete JSON payloads (`Unexpected end of JSON input`) and kept safe warning output for other parse failures using message-only formatting.

## Expected behavior
- Empty bound JSON fields (for example `":principles": ""`) no longer trigger parser warnings.
- Non-JSON-like bound strings no longer trigger parse attempts.
- The noisy Nuxt dev-log stringify warning should no longer be triggered by this path.

## Validation
No automated test suite was run in this step; verify by opening the main route with the provided body payload and confirming the warnings no longer appear.
