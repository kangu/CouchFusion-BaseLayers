# Global Components Hardening (Fixes 1-5)

## Scope
Implemented the 5 risk-mitigation fixes identified during review for the new global-components system.

## Implemented changes

### 1) Prevent alias-to-alias and self-alias target chains
- Server-side validation in `admin.put` now rejects:
  - non-array payloads,
  - invalid/duplicate entries,
  - self-target aliases (`id === component`),
  - alias-to-alias targets.
- Builder alias creation now blocks creating a global alias from a node that is already a global alias.

### 2) Avoid losing pending global alias edits on unmount
- Builder now triggers a final persistence attempt on unmount when pending alias patches exist.

### 3) Align enabled/disabled alias behavior
- Alias hydration and serialization alias-id matching now only consider **enabled** aliases.
- Prevents disabled alias ids from being treated as active global aliases in page persistence flow.

### 4) Guard alias id collisions with base component ids
- Builder alias modal rejects alias names that collide with existing component ids.
- Admin `/admin/pages` global-components save path now validates and rejects colliding alias ids and duplicate aliases.

### 5) Reduce stale globals on public page runtime
- Starter app catch-all page now refreshes global component registry:
  - on route changes,
  - on window focus,
  - on visibility return (tab active),
  - with small cooldown to avoid noisy refreshes.

## Files changed
- `layers/content/app/components/builder/Workbench.vue`
- `layers/content/server/api/content/global-components/admin.put.ts`
- `layers/content/app/pages/admin/pages.vue`

## Validation
- `apps/nuxt-app-starter`: `npx nuxi prepare` passed.
