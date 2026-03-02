# Summary
Hardened `/admin/datasync` styling so it renders consistently across host apps and does not depend on app-specific custom classes.

# Changes
- Updated `pages/admin/datasync.vue`:
  - Replaced app-specific classes:
    - `bg-orange-custom` -> `bg-orange-500`
    - `hover:bg-orange-custom-hover` -> `hover:bg-orange-600`
  - Added root scope class:
    - `<section class="ds-root ...">`
  - Added scoped style block for isolation:
    - explicit font stack and line-height
    - box-sizing reset inside `.ds-root`
    - margin reset on key typographic/table elements
    - table collapse/width normalization

# Why
- `bg-orange-custom` classes were not guaranteed in every implementing app.
- Host/global CSS could alter baseline element styling and create visual drift.
- The scoped root reset improves consistency without relying on host app styling.

# Note
- Visual verification on `http://192.168.5.172:7833/admin/datasync` is currently blocked by admin auth (route renders 404 for non-admin session).
