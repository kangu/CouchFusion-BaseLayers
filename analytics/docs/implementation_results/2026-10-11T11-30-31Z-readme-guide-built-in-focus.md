# README + HTML guide, built-in engine first

## Initial prompt
"Make sure to include a proper guide html readme on how the system operates and how to set it up, alongside a readme.md file. We're not interested in umami anymore, let's focus more on the builtin."

## Plan followed
1. Rewrote `README.md` around the built-in engine: what you get, how it works, setup, tracking, dashboard, configuration, privacy, sharing/API/pixels/import, operations, troubleshooting, development.
2. Added `README.html`: the same guide as a self-contained page (sidebar contents, data-flow diagram, no external assets).
3. Moved the previous Umami setup notes to `docs/umami-cloud-forwarding.md` and reduced Umami to a short legacy section.
4. Updated `agents.md` to lead with the built-in engine and point at the new docs.

## Summary
- Documentation only. No behaviour changed: `analytics_mode` still defaults to `umami_cloud` when unset, and kangu's local config is still `dual`.

## Next steps
- Decide whether to switch kangu to `self_hosted` now, and whether to make `self_hosted` the default for apps that haven't set a mode.
