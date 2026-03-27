# Sidebar Icon Overrides (Consumer-Scoped)

## Summary
- No maintenance domain/API behavior changed.
- Gas-maintenance now overrides maintenance menu icon names at the consuming app level via `appConfig.adminWorkspace.iconOverrides`.

## Impact on Maintenance Layer
- `layers/maintenance/nuxt.config.ts` section contracts remain unchanged.
- Existing `icon` defaults in maintenance section entries continue to act as shared defaults.
- Consuming apps can now customize icon names per route without editing this layer.

## Verification
- Verified through consuming app build:
  - `apps/gas-maintenance` -> `bun run build` passed.

