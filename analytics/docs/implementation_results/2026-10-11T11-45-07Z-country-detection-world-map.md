# Country detection check + world map widget

## Initial prompt
"It's behind Cloudflare, yet I have a Caddy proxy in between. Proceed to add the lowest overhead option for detecting the country. In the overview, provide a very nice and performant visualization of the world with highlighted visiting countries. Make the widget stand out as the jewel of the page (yet still minimalist)."

## Plan followed
1. Country detection: the lowest-overhead option is Cloudflare's `CF-IPCountry` request header, which the collector already reads (`server/engine/net.ts`). Caddy's `reverse_proxy` forwards it by default, so no lookup code or database was added. Added in-memory counters (`status.geo`) and a line in Settings → Engine showing how many hits carried a country.
2. World map: `scripts/generate-world-dots.mjs` builds a staggered Miller-projection dot grid from Natural Earth 50m data (156 x 90 cells, 4,437 land dots, 230 countries, 12 KB) into `admin/utils/world-dots.ts`.
3. `admin/components/WorldMap.vue`: canvas rendering (one path for land, one per visiting country, soft glow, intro sweep that respects reduced motion), hover tooltip, top-6 list, click to filter, theme tokens, resize handling. Placed full width under the time chart in the overview and the shared dashboard.
4. Docs: README.md, README.html (Country detection section), agents.md.

## Summary
- Verified in a browser with 145 temporary sample events across 17 countries (inserted three days back, viewed through a temporary share link, then deleted along with the link): rendering, hover tooltip, list highlight and click-to-filter work.
- 35 unit tests pass (the two CouchDB tests were skipped in that run).
- Not verified: real `CF-IPCountry` values arriving through Cloudflare and Caddy in production. Check Settings → Engine after deploying.
- Countries too small for the grid (for example Luxembourg) aren't drawn; the widget says how many are missing and the Countries table lists them.

## Next steps
- After deploy, confirm the country counter in Settings → Engine is above zero.
