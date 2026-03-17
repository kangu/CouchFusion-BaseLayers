# Fix Korean Flag SVG Rendering

## Request
Korean flag (`ko`) was rendering incorrectly in locale selector chips.

## Change
- Replaced `/layers/content/app/assets/flags/ko.svg` with a corrected Taegeukgi vector.
- Removed internal `id`/`use` dependencies by inlining paths so multiple inline instances cannot collide in DOM id resolution.

## Impact
- Locale chips now render a correct Korean flag shape consistently.
- Safer inline SVG behavior when the same flag appears multiple times in one page.
