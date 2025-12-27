# Bunx Vitest Failure Analysis

## Initial prompt
Some tests are failing, use bunx vitest to check. Explain why.

## Implementation Summary
Implementation Summary: Ran `bunx vitest --config layers/vitest.config.ts` and found failures caused by the missing `_tests/setup/content.ts` path (root mismatch) and a missing `jsdom` dependency required for jsdom tests.

## Documentation Overview
- The Vitest config points at `./_tests/setup/content.ts` and, when run from the repo root, resolves to `/Users/radu/Projects/nuxt-apps/_tests/...` which does not exist; the file lives under `layers/_tests/...`.
- jsdom is not available in the project dependency tree, so any `@vitest-environment jsdom` tests fail during environment setup.
- The current include pattern is broad (`**/*.spec.ts`) and pulls in tests from `apps/*` as well; those tests also fail until the setup path and jsdom are resolved.

## Implementation Examples
```bash
bunx vitest --config layers/vitest.config.ts
```
