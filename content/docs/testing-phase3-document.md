# Testing Plan – Document Runtime Coverage

## Initial Prompt
```
I want to test the <Document> component against a set of minimark predefined documents where I want to check that the AST engine does its job and produces valid vuejs rendered components. Some fixtures for the global content components need to be supplied with the tests, so <Document> recognizes them. Draft the plan on how to approach this. I want it setup initially with a couple of test cases, but then I want to add later to it as I develop more complex components and push the props/slots system to its limits.
```

## Implementation Summary
Implementation Summary: Added a jsdom-based Vitest suite for the runtime `<Content>` renderer using handcrafted HAST fixtures and stub components to validate minimark AST output against Vue render results.

## Documentation Overview
- Introduced `content/tests/runtime/document.spec.ts` covering plain markup rendering plus component props/slot scenarios using stubbed `HeroBlock` and `CardBlock` implementations.
- Updated the shared Vitest config (`layers/vitest.config.ts`) with the Vue plugin, jsdom support, and broader `include` patterns so runtime tests run alongside CouchDB-backed suites.
- Installed supporting dependencies (`@vue/test-utils`, `vue`, `@vitejs/plugin-vue`, `jsdom`, `minimark`) in `layers/package.json` and documented setup in `layers/README.md`.

## Implementation Examples
- `content/tests/runtime/document.spec.ts:1` — jsdom-based tests mounting `<Content>` with HAST fixtures and verifying rendered output.
- `layers/vitest.config.ts:1` — Vitest configuration now loading env vars, Vue plugin, and applying jsdom per-file via annotations.
- `layers/README.md:73` — instructions for preparing `.env`, spinning up CouchDB, and running `bunx vitest --run` for the full suite.
