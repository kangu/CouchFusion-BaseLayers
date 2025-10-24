## Initial Prompt
Integrate the content layer into the app by extending the necessary layers and the nuxt.config.ts app with the needed config. Refactor the pages/index.vue component to split it into sub-components which conform to the structure imposed by the content layer generation script at cli-content/generate-component-registry.mjs. The goal is to have like in the bitvocation-demo app a single [[..slug]].vue page which loads the content from the database and renders the vue components. Extract the current content from the inde.vue page into a json document that I will manually upload into the couchdb for the "/" route. Strive for minimal impact on other areas of the applicaiton. Any time your confidence for taking an actions is < 80%, ask for clarification. Present implementation plan before proceeding on my instructions.

## Implementation Summary
Integrated the shared content layer into pacanele-landing, generated builder-ready section components, swapped the static route for a dynamic catch-all renderer, and exported the landing layout as a MinimalContentDocument JSON for CouchDB.

## Documentation Overview
- Relaxed the content layer peer dependency (`layers/content/package.json`) to accept Nuxt `^3.12.0`, unblocking pacanele-landing from extending the shared layer without peer install warnings.
- Verified the CLI workflow by generating `apps/pacanele-landing/content-builder/component-definitions.ts`, ensuring the new section components surface inside the builder as expected.
- No runtime APIs changed; consuming apps continue to rely on `useContentPagesStore` and `contentToMinimalDocument` for rendering dynamic pages.
- Exposed the builder registration plugin directly in `layers/content/plugins/register-builder.ts`, eliminating Nuxt’s warning about plugins not wrapped in `defineNuxtPlugin`.

## Implementation Examples
- **Peer dependency support**
  ```json
  {
    "peerDependencies": {
      "nuxt": "^3.12.0 || ^4.0.0"
    }
  }
  ```

- **Registry generation command**
  ```bash
  node cli-content/generate-component-registry.mjs --app=pacanele-landing
  ```
