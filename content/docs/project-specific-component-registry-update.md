# Project Specific Component Registry Update

## Initial Prompt
Implement the specs in layers/content/docs/specs/project_specific_component_registry.md. Proceed step by step with each section and mark that in the spec document as it's done to be used as reference when resuming work at a future time. 
Ask me for anything that after evalulation, you are not so sure what decision to make. Strive for minimal impact on other areas of the applicaiton. Any time your confidence for taking an actions is < 80%, ask for clarification.

## Implementation Summary
Separated the builder's default text/slot components from project overrides by loading `~/content-builder/component-definitions` modules, and added the bitvocation demo registry file so app-specific entries like `hero-section` and `you-tube-embed` merge cleanly with the shared defaults.

## Documentation Overview
- The content layer keeps universal builder components in `defaultDefinitions`, while optional project modules are discovered via `import.meta.glob` and merged by `id`.
- Projects can now create `~/content-builder/component-definitions.(ts|js)` to expose custom component metadata without modifying the shared layer.
- The bitvocation demo app registers its custom hero and YouTube components through the new registry file, ensuring the builder palette mirrors prior behaviour.

## Implementation Examples
- `layers/content/app/composables/useComponentRegistry.ts:5` – introduces `defaultDefinitions`, project glob loading, and merge logic.
- `apps/bitvocation-demo/content-builder/component-definitions.ts:1` – exports the app-specific component definitions consumed by the layer.
- `layers/content/docs/specs/project_specific_component_registry.md:1` – records the step-by-step completion notes for the spec.
