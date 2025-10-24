## Initial Prompt
```
I want to have a /k alias for the /builder path so I can type it in faster
```

## Implementation Summary
Implementation Summary: Registered a `/k` catch-all alias for the shared builder page and added the prefix to the reserved content list so sitemap and middleware skips it automatically.

## Documentation Overview
- Updated the route registration utility to emit both `/builder/:target(.*)*` and `/k/:target(.*)*`, reusing the same inline editor component.
- Ensured `/k` joins the reserved content prefixes, keeping the alias out of sitemap output and bypassing content middleware fetches.

## Implementation Examples
```ts
pages.push({
  name: BUILDER_ALIAS_ROUTE_NAME,
  path: BUILDER_ROUTE_ALIAS_PATH,
  file,
})
```
```ts
export const RESERVED_CONTENT_PREFIXES = [
  '/builder',
  '/k',
  '/__'
]
```
