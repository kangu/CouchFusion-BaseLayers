# Extracted `<ContentRenderer>`

This folder contains a standalone clone of Nuxt Content's `<ContentRenderer>` component that you can drop into any Nuxt 4 application without installing `@nuxt/content`. It focuses on the **minimal/minimark** rendering path and works purely with pre-parsed JSON AST data—no `@nuxtjs/mdc` dependency required.

## Contents

- `components/ContentRenderer.vue` – minimal-tree renderer component
- `runtime/minimark.ts` – Minimark ↔ HAST helpers (`compressTree`, `decompressTree`, `visit`)
- `types.ts` – shared TypeScript types (component resolvers, Hast nodes, minimal helpers)
- `index.ts` – convenience re-exports (`ContentRenderer`, helpers, types)

## Requirements

- Nuxt 4 (or Nuxt 3) & Vue 3.4+
- Package: `minimark`

Install the missing dependencies in your host project:

```bash
pnpm add minimark
```

## Usage

1. Copy the entire `extracted_component` directory into your Nuxt project (for example, `~/components/extracted_content`).
2. Import and use the component as you would with Nuxt Content:

```vue
<script setup lang="ts">
import { ContentRenderer } from '~/extracted_component'
import type { MinimarkTree } from 'minimark'
import { decompressTree } from '~/extracted_component'

const page = await $fetch<{
  id: string
  body: MinimalTree
}>('/api/pages/home.json')

const body = decompressTree(page.body)
</script>

<template>
  <ContentRenderer :value="{ ...page, body }" />
</template>
```

### Props

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `value` | `Record<string, unknown>` | — | Parsed document. If `value.body.type` is `minimal`/`minimark`, it is expanded automatically. |
| `excerpt` | `boolean` | `false` | Render the `value.excerpt` tree instead of the full body. |
| `tag` | `string` | `'div'` | Root wrapper tag for rendered nodes. |
| `components` | `Record<string, unknown>` | `{}` | Tag → component/alias map applied during rendering. Accepts strings (aliases) or Vue components. |
| `data` | `Record<string, unknown>` | `{}` | Passed through to the default/empty slots for custom fallbacks. |
| `class` | `string \| Record<string, unknown>` | `undefined` | Class applied to the root wrapper. |
| `componentResolvers` | `Record<string, ComponentResolver>` | `{}` | Optional registry for resolving non-HTML tags to Vue components or async loaders. |

### Resolving Custom Components

When content references non-HTML tags (e.g. `<ProseCode>`), the renderer tries to resolve them in the following order:

1. `componentResolvers[tag]`
2. `resolveComponent(tag, false)` (Nuxt auto-imports/globally registered components)
3. Fallback to the raw string (rendered as-is)

You can provide synchronous components, async loaders, or string aliases:

```ts
import { ContentRenderer } from '~/extracted_component'

const componentResolvers = {
  ProseCode: () => import('~/components/prose/ProseCode.vue'),
  Button: MyButtonComponent,
  'Fancy-New-Tag': 'FallbackHtmlTag',
}
```

### Working With Minimark Trees

Use the helper exports when you receive or store compressed Minimark payloads:

```ts
import { decompressTree, compressTree } from '~/extracted_component'
import type { MinimalTree } from '~/extracted_component'

const compressed: MinimalTree = await fetchMinimalPayload()
const body = decompressTree(compressed)

// Later, to persist edits:
const persisted = compressTree(body)
```

## Testing

Add a local Vitest/Cypress test or a Nuxt playground page that imports `ContentRenderer` from this folder, feeds it a known minimal tree, and snapshots the rendered HTML. The component mirrors Nuxt Content's slot semantics: if the body is empty, the `empty` slot is rendered.

## Notes

- No files outside `extracted_component/` are modified.
- Works entirely with pre-built minimal/minimark JSON—no `@nuxt/content` or `@nuxtjs/mdc` runtime required.
- Rendering depends on Vue component resolution; supply missing components through `componentResolvers` when necessary.
