# Content page entry-session gate

## Summary

Added a reusable content metadata policy that requires a configured client-side entry journey before a page becomes directly accessible for the current browser session.

## Public metadata

```ts
meta: {
  routeAccess?: {
    mode: 'entry-session'
    allowedFrom: string[]
    redirectTo: string
  }
}
```

## Behavior

- Missing policy leaves content routes public.
- Allowed source paths are normalized and deduplicated.
- External URLs, queries, fragments, empty lists, self references, and redirects outside `allowedFrom` fail validation.
- A valid client entry grants a target- and policy-specific browser-session cookie.
- Cookies use the target path, `SameSite=Lax`, and omit expiry/max-age.
- Missing access redirects with HTTP 302.
- Invalid persisted policy fails closed with 404 and a configuration warning.
- Locale-prefixed routes compare base paths and localize the redirect destination.
- Manually ignored content paths can still resolve access metadata without turning reserved application or asset routes into content routes.
- Localized reads inherit `meta.routeAccess` from the master document.
- Inline editor preview requests (`inline-preview`) bypass route-access enforcement after the page is loaded, allowing `/builder/<path>` and `/k/<path>` to edit gated or misconfigured pages without public redirects.

## Editor

The page-meta panel now provides Public and Entry page required modes, allowed-source routes, redirect destination, inline validation, and default-locale ownership. Translated pages display the inherited policy read-only.

## Verification

- Policy, normalization, fingerprint, server-cookie parsing, and action-resolution unit tests.
- Page serialization and localized inheritance tests.
- Page-meta editor model tests.
- Live Bitvocation browser acceptance covering fresh direct access, valid entry, refresh, same-session revisit, new context, and unlisted client entry.
- Authenticated editor acceptance confirming `/k/career-compass/start` keeps its iframe on `/career-compass/start?inline-preview=1` while the published route still redirects.
