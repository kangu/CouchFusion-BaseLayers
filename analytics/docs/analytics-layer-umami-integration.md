# Analytics Layer Umami Integration

## Initial Prompt
Create a new analytics layer with the useUmami composable and directive and plugins for registering. Create a readme for easily embedding this into a new project. Integrate it as a sample inside the radustanciu app.

## Implementation Summary
Manual implementation; no automated code generator output was produced.

## Documentation Overview
- Added the `layers/analytics` Nuxt layer with runtime config defaults, Umami plugin, composable auto-import, and developer README.
- Implemented `useUmami` composable and `v-umami` directive via `plugins/umami.client.ts`, wiring runtime configuration, script loading, and cleanup logic.
- Registered type augmentations (`types/umami.d.ts`) so consuming apps get `$umami` typings.

## Implementation Examples
- Layer configuration exposing composables/plugins (`layers/analytics/nuxt.config.ts`).
- Shared directive wiring analytics events (`layers/analytics/plugins/umami.client.ts:61`).
- Composable usage entry point (`layers/analytics/composables/useUmami.ts:9`).
