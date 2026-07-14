# Canonical Component Registry Generator

## Initial problem

Running a consuming application's normal `bun run dev` rebuilt `component-definitions.ts` through the Content-layer watcher, but did not rebuild the CouchFusion UI metadata in `component-definitions.json`. The UI therefore required a manual **Rebuild Registry** action before it could list the current components.

## Root cause

Registry parsing existed twice:

- `layers/content/scripts/generate-component-registry.mjs`, used by normal Nuxt development, wrote only TypeScript;
- `cli-content/generate-component-registry.mjs`, used by the explicit UI rebuild, wrote TypeScript and JSON.

The copies had also accumulated different behavior. The Content copy owned multi-directory discovery and compiler compatibility, while the CLI copy owned the UI manifest and image-field inference.

## Implemented plan

1. Moved the paired TypeScript/JSON output contract into `layers/content/scripts/registry-output.mjs`.
2. Updated the Content generator to create shared registry records and install both output files on every run.
3. Merged image-field inference and strict `previewSections` normalization into the canonical generator while retaining configured directories, `--component-dir`, and the Vue `NodeTypes` fallback.
4. Replaced both `cli-content` generator entry points with argument-, stdio-, signal-, and exit-code-forwarding delegates to the Content scripts.
5. Deleted the duplicate CLI parser and output implementation.
6. Added contract tests for the Nuxt dev module → watcher → canonical generator path.

## Result

The Content layer is now the only registry parser. A normal Nuxt dev watcher rebuild produces:

- `component-definitions.ts`, consumed by the application;
- `component-definitions.json`, consumed by the CouchFusion project UI.

The JSON manifest is version `1` and contains the SHA-256 digest of the exact TypeScript bytes. Both files are written and synced as sibling temporary files; TypeScript is installed first and JSON last as the commit marker. A reader can reject an interrupted or mismatched pair by comparing the digest.

Existing app package scripts that still call `cli-content/generate-component-registry.mjs` or `cli-content/watch-component-registry.ts` remain compatible and reach the same Content-layer implementation.

## Verification

- `bun test content/tests/scripts/registry-output.test.mjs content/tests/scripts/generator-contract.test.mjs`: 12 passed.
- Focused preview compatibility suite: 10 passed.
- `bun test` in `cli-content`: 5 passed.
- `go test -race ./...` and `go vet ./...` in `cli-init`: passed.
- Real `apps/with-ui` generation through both the Content command and the legacy CLI command produced 2 components and the same linked digest, `2fdc792c6669ac659eafa89ea0196ee6b5e3c9bc22d72a420f8f6236e92518ff`.
- The real app registry files were restored and matched their original hashes after the proof.

The complete Content test run retained the same three failures present before this implementation: two translation-menu tests resolve a non-existent path from the repository root, and one focused-editor source assertion expects an older call shape. No additional full-suite failures were introduced.

## Next steps

- Fix the three pre-existing Content test failures independently so the full suite can return a clean exit status.
- When the manifest schema needs to evolve, increment its version and keep JSON as the final commit marker.
