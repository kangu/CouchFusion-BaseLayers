# Root Write-Path Legacy ID Compatibility

The content-layer save path now treats existing root documents stored under the legacy `page-/` id as first-class pages. Updates reuse the legacy id instead of failing with 404 or returning stale response data.

Verification:

```bash
cd layers
bunx vitest --config vitest.config.ts content/tests/api-content-pages.spec.ts --run
```
