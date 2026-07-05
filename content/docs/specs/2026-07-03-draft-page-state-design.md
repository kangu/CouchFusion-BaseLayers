# Draft Page State Design

## Goal

Add a draft state for content pages so unpublished work can be edited and previewed by admins and editors, while anonymous users receive a 404 and draft pages are excluded from the sitemap.

## Decisions

- Store publication state directly on the master content page document as `publicationState`.
- Supported values are `published` and `draft`.
- Missing or invalid stored values are treated as `published` for backward compatibility with existing content.
- Incoming mutation payloads must reject invalid publication states with 400.
- New pages and cloned pages created from `/admin/pages` default to `draft`.
- Publication state applies to the whole page group across all locales. Locale documents do not carry independent publication state.
- Draft access is enforced server-side. Client code may show draft state, but it is not trusted for access control.

## Data Model

Extend `ContentPageDocument`:

```ts
export type ContentPagePublicationState = 'published' | 'draft'

export interface ContentPageDocument {
  publicationState?: ContentPagePublicationState
}
```

Add a small normalizer:

```ts
export const normalizePublicationState = (value: unknown): ContentPagePublicationState =>
  value === 'draft' ? 'draft' : 'published'
```

The API summary should expose the normalized value as `publicationState` so admin tables do not need to inspect raw documents.

## Access Control

Add a content-editor session helper that accepts `admin`, `_admin`, and `editor` roles. Also add an optional session resolver for public read endpoints so they can allow drafts only when a valid content-editor session is present, without requiring authentication for normal published reads.

Draft read behavior:

- Public requests to `GET /api/content/pages?path=...` return 404 when the master document is `draft`.
- Admin/editor requests to the same endpoint return the page.
- Missing pages still return 404.
- Unauthorized draft responses must remain 404, not 403, so draft URLs are not disclosed.
- `GET /api/content/pages` should keep serving the admin table, but public callers should not receive draft entries unless they have an admin/editor session.

The content route middleware already fetches pages through this endpoint during SSR, so it inherits the server-side 404 behavior without a separate route-level draft check.

## Admin Pages UI

Update `/admin/pages` with inline publication state editing:

- Add a `Status` column.
- Display each row as `Published` or `Draft`.
- Clicking the status opens a compact inline control in that row.
- Changing the value saves immediately.
- Only the edited row shows pending state.
- On success, the row updates in place.
- On failure, revert the row to its previous value and show a table-level or row-level error.

The existing filters should gain a publication filter:

- `All`
- `Published`
- `Draft`

Create and clone flows should set `publicationState: 'draft'` unless the UI explicitly supplies another value later.

## Server Mutation API

Add a focused endpoint for inline status changes instead of requiring the full page save path.

Suggested route:

```txt
PATCH /api/content/pages/publication-state
```

Payload:

```json
{
  "path": "/about",
  "publicationState": "draft"
}
```

Behavior:

- Require content-editor session.
- Resolve the master page document for the base path.
- Update only the master document's `publicationState` and `updatedAt`.
- Preserve body, SEO, layout, metadata, i18n metadata, and locale documents.
- Return the normalized page summary so the store can update the row.
- If the page does not exist, return 404.
- If the payload state is invalid, return 400.

This endpoint should not mutate every locale document because publication state is page-group-wide and sourced from the master document.

## Sitemap Behavior

The sitemap content-page source must exclude pages whose master document normalizes to `draft`.

The XML sitemap implementation currently lives in `layers/sitemap-xml/server/api/sitemap.xml.get.ts` and reads the content database through the `content/by_path` view. The draft filter belongs in that content-route collection path. Static routes discovered from app `/pages` and app-config `sitemapExtraRoutes` keep their current behavior. Draft filtering applies to CouchDB content pages.

## Store Behavior

Extend `ContentPageSummary` with:

```ts
publicationState: ContentPagePublicationState
```

Add a store action:

```ts
updatePublicationState(path, publicationState, options?)
```

The action should call the focused endpoint, update the cached page summary and index entry, and preserve existing locale-aware store keys.

## Tests

Add focused coverage for:

- Existing pages without `publicationState` are treated as `published`.
- Public fetch of a draft page returns 404.
- Admin/editor fetch of a draft page succeeds.
- Inline publication-state endpoint updates the master document only.
- `/admin/pages` index exposes normalized publication state.
- Sitemap generation omits draft content pages.
- Create/clone defaults produce draft pages.

## Rollout Notes

No data migration is required because legacy documents default to `published`.

The implementation should avoid changing unrelated app behavior. Existing app-level ignored-prefix and sitemap-extra-route configuration should continue to work unchanged.
