# ContentImageField ImageKit live adjustments (phase 1)

## Summary
Implemented a preview-only ImageKit adjustments panel in `ContentImageField.vue` to let editors tune resize/crop-related transforms live.

## Changes
- Added an ImageKit-only controls panel, shown when the current source resolves as ImageKit.
- Added controls:
  - width (`w-*`)
  - height (`h-*`)
  - aspect ratio (`ar-*`)
  - crop mode (`c-*`)
  - focus (`fo-*`)
  - quality (`q-*`)
  - format (`f-*`)
  - reset button
- Added read-only `Result URL (Preview)` field showing the transformed URL.
- Added computed transform builder that composes a `tr:` string and applies it through `withImageKitTransformations(...)`.
- Kept behavior preview-only: source value emitted/stored remains the original path/URL.

## Defaults
- Width defaults to `1000`.
- Format defaults to `auto`.
- Fallback transform remains `w-1000,f-auto` when no explicit control value is provided.

## Result
Editors can now adjust ImageKit image rendering in real time in the admin image field without mutating persisted content values.
