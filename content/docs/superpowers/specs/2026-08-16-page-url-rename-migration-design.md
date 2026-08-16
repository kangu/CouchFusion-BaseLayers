# Page URL rename migration design

## Goal

Provide a `Rename URL` action next to the URL field in the Workbench node editor. It moves the current content page to a new route by cloning the master document and every localized document to their corresponding new routes, then removes the old routes by default.

Editors can optionally retain a permanent redirect at each old route. The redirect option defaults to off.

## Scope

- The feature is available from the Workbench page configuration/SEO card, adjacent to the editable URL.
- It works for the master page and all configured content locales.
- It preserves the target page's body, page metadata, SEO data, publication state, global aliases, and route-access policy.
- It does not copy page-history documents. Existing history remains attached to the retired source IDs; new edits begin a new history trail at the target route.
- It does not rename references held in other pages, menus, or external systems.

## User flow

1. Editor selects `Rename URL` next to the page URL field.
2. A modal shows the current URL, accepts a new URL, and includes an unchecked `Keep permanent redirect from old URL` checkbox.
3. The modal lists the affected master and localized routes after validating the new URL.
4. On confirmation, the application creates all target pages, then either deletes all old routes or converts them to redirects.
5. The index refreshes and the workbench opens the new master route. The UI shows a success summary, including whether redirects were retained.

The action must be disabled while a page is unsaved, while a migration is in progress, and when editing a translated page. The default-locale/master page owns URL migration, matching other master-owned page settings.

## Architecture

### Dedicated server migration endpoint

Add an authenticated editor/admin endpoint rather than coordinating individual saves and deletes in the Workbench. The endpoint receives:

```ts
{
  sourcePath: string
  targetPath: string
  keepRedirect: boolean
}
```

It resolves configured locales and source documents, calculates each target localized route, validates all target IDs before mutation, then performs the migration. The endpoint returns the new master page summary, affected routes, redirect status, and a structured partial-completion report on error.

The endpoint validates all of the following before writing:

- caller has `admin`, `_admin`, or `editor` authorization;
- source and target are distinct normalized internal content routes;
- the source master exists and each existing localized page can be resolved;
- every target route is free, except for a target that is explicitly part of no-op validation (which is otherwise rejected);
- the target does not collide with reserved/ignored application routes;
- the current page is not an old-route redirect document.

### Document migration

For every existing master or locale page document:

- deep-clone its content data;
- generate the target document ID and derived stem from the target route;
- clear CouchDB revision and source identity fields;
- preserve the body, page metadata, SEO values, navigation, publication state, and locale fields;
- save the target document before modifying its old counterpart.

If redirects are disabled, delete each old locale document only after its target counterpart has been saved. If redirects are enabled, replace the old document body with a minimal redirect document instead of preserving its original page content:

```ts
meta: {
  redirectTo: '/new-path'
}
```

Each localized old route redirects to the corresponding localized target route. Redirect documents are published and carry no inherited route-access policy.

### Runtime redirect behavior

Extend the content runtime/middleware to recognize validated redirect metadata before normal page rendering and return a permanent HTTP 308 redirect. Locale resolution must preserve the locale in the destination path.

Redirect metadata is a distinct page-migration contract, not `meta.routeAccess`. A page cannot simultaneously be an entry-session-gated content page and an old-route redirect. This prevents route-access settings from blocking redirect delivery.

## Failure handling and consistency

CouchDB cannot atomically mutate multiple page IDs, so the operation uses a recoverable order:

1. validate all source and target paths;
2. create all target documents;
3. delete or replace old documents one at a time;
4. return a result summary.

On failure, never remove an old route whose replacement has not been written. The server returns the completed target and source operations, allowing the editor to retry or recover. It must not attempt automatic destructive rollback, because concurrent edits could make rollback unsafe.

## Client responsibilities

The pages store exposes `renamePageUrl(input)` and updates or invalidates cached index/detail entries after a successful result. Workbench owns only dialog state, client-side preliminary validation, pending/error presentation, and loading the returned target route.

The existing direct URL input remains a normal unsaved-document field. Once Rename URL exists, saving a changed URL through the ordinary save path must be prevented or directed to the Rename URL dialog, so accidental document-ID migration cannot occur.

## Testing

Add focused coverage for:

- a master-only rename with default deletion;
- a multi-locale rename with matching localized paths;
- optional redirect documents and 308 runtime behavior;
- target collision, invalid path, reserved-route, missing-source, and authorization rejection;
- preservation of draft state, route-access data on the new page, and removal of route-access data from old redirect documents;
- partial completion reporting after an injected write failure;
- Workbench modal state, default-off redirect choice, disabled translated/unsaved conditions, and successful target load.

Run layer tests from `layers/` with `vitest.config.ts`, then run target-app preparation after a consuming app is selected.

## Acceptance criteria

- `Rename URL` is visible beside the page URL for a saved default-locale page.
- A rename migrates every existing localized page to the matching new URL.
- Old routes are deleted by default.
- Selecting redirect retains old routes only as permanent 308 redirect documents.
- New routes preserve page content and master-owned settings.
- A failed migration leaves every source route intact until its replacement exists and returns actionable recovery information.
