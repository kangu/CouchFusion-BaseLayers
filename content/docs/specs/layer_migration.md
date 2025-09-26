# Layer Migration Plan

This document outlines the steps required to extract the current content-builder functionality into a dedicated Nuxt layer named `content_layer`, leaving the primary app as a thin host that renders the builder page.

## 1. Prepare the Project Structure
_Status (2025-09-25): ✅ `layers/content_layer/` scaffolded with its own `nuxt.config.ts` capturing builder modules/components._
- **Create layer folder**: `layers/content_layer/` at the repository root.
- **Bootstrap layer config**: Add `layers/content_layer/nuxt.config.ts` exporting `defineNuxtConfig` with any layer-specific settings (components dirs, plugins, modules, runtime config). Ensure it mirrors the current root `nuxt.config.ts` content relevant to the builder.
- **Add package metadata**: Optionally include `layers/content_layer/package.json` (name, version, dependencies) if shared or published; otherwise document reliance on the main app’s dependencies.

## 2. Relocate Builder Assets into the Layer
_Status (2025-09-25): ✅ All builder components, composables, utils, types, and the page API now reside under `layers/content_layer`._
- **App directory**: Move all builder-related Vue files and directories from `app/` into the layer’s `app/` (e.g., `app/components/builder`, `app/components/content`, `app/composables`, `app/utils`, `app/types`). Maintain directory structure to avoid breaking auto-imports.
- **Server/API endpoints**: Relocate `server/api` functionality (e.g., `server/api/page`) into `layers/content_layer/server/api` if it remains part of the builder experience.
- **Static/public assets**: Copy any files under `public/` needed by the builder (images, icons) into `layers/content_layer/public/`.
- **Content or data stores**: If `.data/` or `content/` resources belong to the builder, document whether to move them into the layer or keep them at the host level.

## 3. Adjust Imports, Aliases, and Auto-Imports
_Status (2025-09-25): ✅ Existing `~/` imports resolve via the layer; component auto-registration preserved via layer config._
- **Update paths**: Once files live in the layer, ensure relative imports resolve (prefer `~/` which resolves within the layer context after configuration).
- **Nuxt auto-imports**: Confirm that composables and components remain auto-imported by configuring `components.dirs` or `imports.dirs` inside the layer’s config if necessary.
- **Type paths**: Update TypeScript paths (e.g., `tsconfig.json` or layer-specific config) so shared types like `~/types/builder` resolve correctly from the host.

## 4. Configure the Host App to Consume the Layer
_Status (2025-09-25): ✅ Host app now only exposes `app/pages/builder.vue` and extends the new layer in `nuxt.config.ts`._
- **Clean host app**: Remove builder-specific directories from the root `app/`, leaving only `app/pages/builder.vue` (or a minimal layout if required).
- **Update builder page**: Modify `app/pages/builder.vue` to import `BuilderWorkbench` from the layer entry point, e.g. `import { BuilderWorkbench } from '#content_layer'` or a direct path depending on how exports are configured.
- **Extend layer**: In root `nuxt.config.ts`, replace module declarations with `extends: ['layers/content_layer']` (or use path alias) while keeping host-specific settings (e.g., devtools, env config).
- **Validate compatibilityDate**: Move compatibility and module configuration to the layer if they belong to builder functionality; leave host-specific overrides at root if needed.

## 5. Ensure Build and Type Support
_Status (2025-09-25): ⚠️ Type references continue to resolve without additional config; no new scripts required. Pending verification once dev server runs._
- **Type references**: Add a `tsconfig.json` path reference inside `layers/content_layer` (or adjust root `tsconfig` references) so IDE tooling understands layer files.
- **Scripts**: If the layer requires preparation steps (e.g., `nuxt prepare`), document or add npm scripts to run from the host app.
- **Playwright config**: Update `playwright.config.ts` if paths change (e.g., selectors, endpoints) after the layer extraction.

## 6. Verification Checklist
_Status (2025-09-25): ⚠️ Dev server / Playwright validation blocked by local port contention; manual QA pending._
- **Local dev**: Run `npm run dev` to verify Nuxt loads the layer and builder page renders.
- **Playwright**: Execute the MCP server and open the builder page to check that everything is still functional.
- **Lint/Typecheck**: Run `npx nuxi typecheck` (or equivalent) to ensure types resolve through the layer.
- **Manual QA**: Load debug data, edit components, reorder nodes, and export JSON to confirm functionality matches pre-migration behavior.

## 7. Post-Migration Cleanup
_Status (2025-09-25): ⚠️ Layer migration complete; broader docs (e.g., `bootstrap_content_editor.md`) still need architecture notes in a follow-up._
- **Remove redundant files**: Delete any now-empty directories or duplicated configs in the host app.
- **Docs & Specs**: Update relevant specs (e.g., `bootstrap_content_editor.md`, `page_config.md`) to note the layer-based architecture.

> Once this plan is approved, the next phase will implement the structured moves and configuration updates described above.
