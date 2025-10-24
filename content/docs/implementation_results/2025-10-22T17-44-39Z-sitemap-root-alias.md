# Sitemap Root Alias

## Initial Prompt
```
How can I most easily render the /api/sitemap.xml route under /sitemap.xml, ideally without having to do any project-specific config
```

## Plan
1. Identify a layer-level approach so `/sitemap.xml` resolves without app changes.  
2. Create a Nitro route alias that reuses the existing sitemap API handler.  
3. Document the update for future reference.

## Implementation Summary
Added `layers/content/server/routes/sitemap.xml.ts` which re-exports the sitemap API handler, making `/sitemap.xml` available automatically in every app consuming the content layer.

## Next Steps
1. Restart running dev servers so Nitro picks up the new route file.  
2. If needed, expose a `/sitemapindex.xml` alias using the same pattern for multi-site setups.
