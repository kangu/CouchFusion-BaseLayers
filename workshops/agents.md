# Layer: workshops

Runtime: nuxt 4.x (not yet wired; no `nuxt.config.ts` or `package.json`).

WIP / planning-only layer. Contains design ideation and user stories for a future "Workshop Gamification Platform" feature (technical-UX alignment workshops with badges, gap analysis, feasibility heatmaps, etc.). No code, no consumers yet.

Status: **empty / not implemented**. No app extends this layer (verified against all `apps/*/nuxt.config.ts` `extends` arrays).

## Folder map

- `readme.md` — feature idea brainstorm (gamification elements, workshop tools, engagement boosters).
- `docs/stories.md` — 24 user stories grouped into 8 epics (onboarding, gap analysis, problem-solving, refinement, planning, gamification, knowledge capture, post-workshop).

## Public API / Exports

- None. No `app/`, `server/`, `utils/`, composables, components, or endpoints.
- No `nuxt.config.ts`, so no `#workshops` alias exists.

## Conventions

- This is a documentation-only folder right now. Treat `readme.md` and `docs/stories.md` as the source of intent for any future implementation.
- When implementation starts, scaffold via the `couchfusion-layer-builder` skill and replace this file with a real layer agents.md.

## Dependencies

- None declared. No `package.json`.
- Future implementation will likely depend on `content`, `database`, and `ui_navigation` layers based on the stories (decision journal, pattern library, role-based views).

## Build / Test commands

- None. No build, no tests, no typecheck.
- Do not run any command expecting this layer to do something — it will not.

## Gotchas / Pitfalls

- Do NOT add this layer to any app's `extends` array expecting functionality — it has no `nuxt.config.ts`, Nuxt will not recognize it as a layer.
- The stories reference AI-powered features ("Discrepancy Detector", "Feasibility Simulator") that are not implemented anywhere; do not assume they exist.
- Filename is lowercase `readme.md`, not `README.md` — preserve casing if you edit it.

## Cross-references

- Root: `/Users/radu/Projects/nuxt-apps/AGENTS.md`.
- Related skills: `brainstorming`, `writing-plans`, `couchfusion-layer-builder` (when scaffolding begins).
- Future cross-layer deps (planned, not present): `layers/content`, `layers/database`, `layers/ui_navigation`.
