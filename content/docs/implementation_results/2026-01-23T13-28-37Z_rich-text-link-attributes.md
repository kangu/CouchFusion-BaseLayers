# Context
- Layer: `layers/content`
- Area: Rich text link editing in `ContentRichTextField` (TipTap)
- Goal: Allow authoring link `download`, `target`, and `rel` attributes while keeping sanitization safe defaults.

# Changes
- Updated the link command prompt to capture `href` plus optional `target`, `rel`, and `download`, prefilling existing values and unsetting when URL is cleared.
- Replaced browser prompts with an in-editor popover that edits URL/target/rel/download together and applies them in one action (target now uses a dropdown with common values).
- Extended rich-text sanitization to allow the `download` attribute and to preserve user-provided `target`/`rel`, auto-appending `noopener noreferrer` only when `target="_blank"` is present without a safe `rel`.
- Normalized empty `download` inputs by removing the attribute post-sanitization.

# Verification
- Opened a rich text field, added a link, and set `target=_blank`, `rel=ugc`, and `download=brochure.pdf`; saved content retained all attributes and rendered with `rel="ugc noopener noreferrer"` and `download="brochure.pdf"`.
- Clearing the URL removed the link mark from selection; leaving target/rel blank defaults to `_blank` with `noopener noreferrer` for safety.
- Reverted custom link click event handlers per request; editor now uses default TipTap behavior (openOnClick disabled via extension config, no extra DOM interception).
