# Layer: planned-events

`Runtime: nuxt 4.x, vue 3.5.x`

**Status: WIP / empty scaffold.** No source code, no `nuxt.config.ts`, no `package.json`. Only a `node_modules/` directory exists (likely a stale install from a prior experiment). Referenced in `apps/ping-pong-events/nuxt.config.ts` extends array, so the layer path resolves — but contributes nothing yet.

## Folder map
- `node_modules/` — stale dependency tree; not a layer export. (Skip; do not treat as source.)

No `app/`, `server/`, `utils/`, `docs/`, or `tests/` directories exist.

## Public API / Exports
- None. No alias declared, no auto-import dirs, no endpoints, no components.

## Conventions
- None established yet. When implementing, follow root `AGENTS.md` conventions (CouchDB `_config` env via `cf_env_planned-events`, design-doc patterns, etc.).

## Dependencies
- None declared. If implemented, will likely extend `../database` and import `#database/utils/couchdb` (pattern from sibling layers).
- Consumed by `apps/ping-pong-events` (declared in its `nuxt.config.ts` extends array).

## Build / Test commands
None. No standalone tooling. The layer currently contributes no build output.

To scaffold, create `nuxt.config.ts` + `package.json` and add `app/` or `server/` sources; see `couchfusion-layer-builder` skill.

## Gotchas / Pitfalls
- `node_modules/` present without a `package.json` — running `bun install`/`npm install` here may fail or wipe the folder. Delete before scaffolding.
- `apps/ping-pong-events` extends this layer; until source is added, the extends entry is a no-op (safe but dead weight).
- Do NOT assume any alias (`#planned-events`) is resolvable — none is configured.

## Cross-references
- Root: `/Users/radu/Projects/nuxt-apps/AGENTS.md`
- Related layers: `layers/database`, `layers/content` (likely consumers when implemented).
- Related skills: `couchfusion-layer-builder`.
