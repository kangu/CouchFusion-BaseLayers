# Initial Prompt
Implement the specs in /Users/radu/Projects/nuxt-apps/cli-content/docs/integrate_inside_layer.md. Proceed step by step with each section and mark that in the spec document as it's done to be used as reference when resuming work at a future time.

# Implementation Summary
Implementation Summary: Integrated the component registry generator/watch into the content layer with default dev auto-watch, exposed bin commands, and documented how apps can trigger registry builds when using `<Content>`.

# Documentation Overview
- Added shared scripts under `layers/content/scripts/` with bin entries (`content-registry`, `content-registry-watch`) in `layers/content/package.json` for manual invocation (`bunx content-registry --app <name>`).
- Introduced a layer module (`utils/component-registry-watch.ts`) that auto-starts the watcher in dev (unless `CONTENT_REGISTRY_WATCH=0`), inferring the app name from `rootDir` under `apps/<name>`.
- Updated `cli-content/docs/integrate_inside_layer.md` with completion checkmarks for command availability and dev auto-watch.
- Usage guidance: wrap `<Content>` projects by running the bin or rely on default dev watch; disable via `CONTENT_REGISTRY_WATCH=0` if needed.

# Implementation Examples
- Manual regenerate from an app directory (or anywhere in repo):
```bash
bunx content-registry --app bitvocation
```
- Start the watcher manually:
```bash
bunx content-registry-watch --app bitvocation
```
- Dev auto-watch (default): when running `bun run dev` in an app extending the content layer, the watcher spawns automatically; disable with `CONTENT_REGISTRY_WATCH=0 bun run dev`.
