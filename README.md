# Layers Overview

The `layers/` directory contains reusable Nuxt 4 layer packages that power apps within this monorepo. Each layer encapsulates domain-specific functionality (routing, composables, server handlers, UI components) so apps can opt into a consistent feature set by extending the layer in `nuxt.config.ts`.

## How Layers Integrate with Nuxt Apps

1. **Install or link the layers** – development workspaces created with `couchfusion` clone this directory alongside `apps/`. When running an app locally, Nuxt can resolve layers via workspace-relative aliases (`#<layer_name>`).
2. **Reference the layer in `nuxt.config.ts`** – add entries to the `extends` array so Nuxt merges the layer’s configuration, plugins, and components into the app build.
3. **Review the layer docs** – each layer has a `docs/` folder with setup notes, API references, and change history. Some layers require environment variables or companion services.
4. **Run the app** – the standard `bun run dev` bootstraps Nuxt with hot reload unless overridden in the app’s dev script.

### Example `nuxt.config.ts`
```ts
export default defineNuxtConfig({
  extends: [
    // layers are two levels up from the app folder
    '../../layers/auth',
    '../../layers/content',
    '../../layers/imagekit'
  ],
  runtimeConfig: {
    public: {
      authEndpoint: process.env.NUXT_PUBLIC_AUTH_ENDPOINT
    }
  }
})
```

### Module Setup Guidance
When `couchfusion create_app` finishes, it writes `docs/module_setup.json` inside the new app directory. That JSON file lists the precise `extends` values and any follow-up steps (for example, adding environment variables). Use it as the source of truth when wiring layers into a freshly cloned app.

## Available Layers

| Layer | Folder | Summary |
|-------|--------|---------|
| Analytics | `layers/analytics` | Integrates Umami analytics tracking, handles excluded paths, and ships composables for anonymous event capture. |
| Auth | `layers/auth` | Provides CouchDB-backed authentication flows, session middleware, and websocket token support for real-time features. |
| Content | `layers/content` | Implements the content workbench, inline editor, component registry, and page configuration tooling for Nuxt CMS experiences. |
| Database | `layers/database` | Supplies shared CouchDB utilities, initialization helpers, and logout/session management helpers used across apps. |
| ImageKit | `layers/imagekit` | Adds ImageKit asset helpers, Nuxt image directives, library pagination, and editor integrations for media management. |
| Lightning | `layers/lightning` | Connects to Lightning/Strike APIs for payment handling, subscriptions, and BTC conversion utilities. |
| Orders | `layers/orders` | Offers server endpoints and utilities for managing orders and purchase flows in commerce-focused apps. |

## Layer Folder Structure
Each layer follows a similar structure:

- `app/` or `plugins/` – Nuxt resources merged into the consuming app.
- `server/` – API routes, middleware, or Nitro handlers provided by the layer.
- `utils/` or `types/` – shared helpers available to apps.
- `docs/` – setup guides, API contracts, and release notes.

Consult individual layer READMEs or docs for feature-specific guidance and environment requirements.

## Maintaining Layers

1. Document changes in the layer’s `docs/` directory (or add entries under `docs/implementation_results/`) whenever you update functionality.
2. Notify app owners when breaking changes occur, especially if new runtime config or environment variables are introduced.
3. When creating new layers, mirror this directory structure, add documentation, and update any bootstrap tooling (`couchfusion` config) so the layer is selectable during app scaffolding.

For more detail on the CLI bootstrap process, review `couchfusion/docs/specs/cli_bootstrap_prd.md` and the sample configuration in `couchfusion/README.md`.
