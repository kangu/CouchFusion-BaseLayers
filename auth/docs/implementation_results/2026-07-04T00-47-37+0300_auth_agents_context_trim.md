# Auth Agents Context Trim

## Initial Prompt

Run the same cleanup on `layers/auth/agents.md` after analyzing what is inside it.

## Plan

1. Read the existing auth layer agent instructions.
2. Verify key facts against the current auth layer config and source files.
3. Remove inventory-style bloat that can be discovered with `rg`, `find`, or `nuxt.config.ts`.
4. Preserve critical paths, public surfaces, conventions, commands, and high-impact gotchas.

## Implementation Summary

- Rewrote `layers/auth/agents.md` as a compact coding-agent operating guide.
- Removed the long consumer app list, exhaustive folder map, endpoint/util inventory, dependency list, docs list, and skill list.
- Kept the startup config requirements, route/middleware names, auth store, login/API surfaces, websocket route, Nostr/proof-of-work warnings, and cookie/session gotchas.
- Added clearer guidance to inspect the target app's instructions before choosing validation commands.

## Next Steps

- Keep future additions focused on constraints that prevent implementation mistakes.
- Prefer source paths and discovery guidance over duplicating full endpoint/component inventories.
