# Content Agents Context Trim

## Initial Prompt

Evaluate `layers/content/agents.md`, identify unnecessary context bloat, and update the file based on the recommendation.

## Plan

1. Review the existing `agents.md` for operational value versus static inventory.
2. Remove exhaustive lists that a coding agent can discover with `rg`, `find`, or `nuxt.config.ts`.
3. Preserve critical operating constraints, commands, public surfaces, and gotchas.
4. Correct inaccurate context while reducing token load.

## Implementation Summary

- Rewrote `layers/content/agents.md` as a compact operating guide.
- Removed the long consumer list, exhaustive folder map, component/composable inventories, endpoint mega-list, package dependency list, and skill list.
- Kept the key routes, aliases, critical paths, conventions, test commands, and high-impact pitfalls.
- Corrected the store name from `usePagesStore()` to `useContentPagesStore`.
- Made the command guidance defer lint/typecheck to consuming app instructions.

## Next Steps

- Keep future additions limited to constraints or facts that prevent common implementation mistakes.
- Prefer linking to source paths and telling agents what to inspect over duplicating large inventories.
