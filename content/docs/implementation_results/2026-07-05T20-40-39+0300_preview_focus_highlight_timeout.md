# Preview Focus Highlight Timeout

## Summary
- Fixed the inline live preview focus highlight so every activation path clears after the configured flash duration.
- Added tracking for the currently highlighted element so stale `builder-highlight-flash` or `builder-highlight-lock` classes are removed when the overlay fades or moves to another section.
- Removed the previous mode guard that allowed lock-style focus highlights to persist indefinitely.

## Verification
- `bunx vitest --config vitest.config.ts content/tests/builder/section-placement-preview-scroll.spec.ts --run`
- `bunx vitest --config vitest.config.ts content/tests/builder --run`
