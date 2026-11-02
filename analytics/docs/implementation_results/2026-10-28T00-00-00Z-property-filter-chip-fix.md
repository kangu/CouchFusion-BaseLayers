# Property filter chip shows "undefined = undefined"

## Symptom
Clicking a row in the dashboard's Events → Properties tab added a filter chip reading
`Property is undefined = undefined`, and only one chip appeared (no event chip).

## Causes
1. **Label format mismatch.** Property rows use `event␟key␟value` (`\u001f` separator), but the
   filter stores `key=value` (the format `server/engine/rollup.ts` `filterVisit` parses).
   `formatDimValue("prop", …)` only handled the row format, so `key`/`val` were `undefined`.
   The server filter itself was applied correctly.
2. **Event filter dropped.** `MetricPanel.select()` called `addFilter` twice. Filters live in
   `route.query`, which `router.replace()` updates asynchronously, so the second call read the
   stale list and overwrote the first.

## Changes
- `admin/utils/format.ts`: `prop` case handles both `event␟key␟value` and `key=value`
  (splits on the first `=` so values containing `=` survive).
- `admin/composables/useAnalyticsState.ts`: new `addFilters(...filters)` writes several filters in
  one route update; `addFilter` delegates to it. Exported from the state.
- `admin/components/MetricPanel.vue`: property click uses `addFilters(event, prop)`.

## Rule going forward
When a UI action adds more than one filter, use `state.addFilters(...)`, never consecutive
`addFilter` calls.

## Verification
- `formatDimValue` checked with bun: `game_id=needle`, `url=a=b`, and the row format all render correctly.
- No consuming-app typecheck: `apps/lovable-gifts-sdd` `nuxt typecheck` fails (no tsconfig.json there).
- Not yet clicked through in a browser.
