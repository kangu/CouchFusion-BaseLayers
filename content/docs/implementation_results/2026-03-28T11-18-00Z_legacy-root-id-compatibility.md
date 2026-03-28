# Legacy Root ID Compatibility

The content API now resolves root-page reads from both `page-/index` and the older `page-/` CouchDB document ids. This prevents SSR 404s in apps like `couchfusioncom` where the home page document still uses the legacy `page-/` id.

Verification:

```bash
cd layers
bunx vitest --config vitest.config.ts content/tests/api-content-pages.spec.ts --run
```
