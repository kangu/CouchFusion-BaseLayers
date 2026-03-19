# Email Preview Sticky Behavior Restored for Page Scrolling

## Issue
HTML preview panel still did not remain sticky while scrolling down the page.

## Root Cause
A previous page-specific CSS override forced `main.flex-1` to `overflow: visible`, changing the layout's intended scroll behavior and interfering with sticky behavior in the admin layout.

## Fix
Updated `layers/email/app/pages/admin/email-templates/[id].vue`:
- Removed global override:
  - `:global(body[data-email-template-page='true'] main.flex-1) { overflow: visible; }`

This restores the members/admin layout default scroll container behavior (`main.flex-1` with `overflow-y-auto`), allowing sticky positioning to work as intended for the preview panel.

## Additional Context
- Sticky behavior remains applied to the preview card (`lg:sticky lg:top-4`).
- Preview scroll restoration logic remains in place for iframe refreshes.
