import type { BuilderNode, BuilderTextNode, ComponentDefinition, ComponentRegistry } from '~/types/builder'

let uidCounter = 0

const defaultDefinitions: ComponentDefinition[] = [
  {
    id: 'p',
    label: 'Paragraph',
    description: 'Rich text paragraph wrapper. Combine with text nodes or inline elements.',
    allowChildren: true,
    childHint: 'Add text nodes or inline components as children.',
    props: [
      {
        key: 'align',
        label: 'Alignment',
        type: 'select',
        options: [
          { label: 'Left', value: 'left' },
          { label: 'Center', value: 'center' },
          { label: 'Right', value: 'right' }
        ],
        default: 'left'
      }
    ]
  },
  {
    id: 'span',
    label: 'Span',
    description: 'Inline span element.',
    allowChildren: true
  },
  {
    id: 'strong',
    label: 'Strong Text',
    description: 'Inline wrapper that renders children with bold emphasis.',
    allowChildren: true,
    childHint: 'Add text nodes or inline components that should display in bold.'
  },
  {
    id: 'template',
    label: 'Template (Slot)',
    description: 'Wrapper for slot content, e.g. title slot.',
    props: [
      {
        key: 'slot',
        label: 'Slot name',
        type: 'text',
        required: true,
        placeholder: 'title'
      }
    ],
    allowChildren: true,
    childHint: 'Place components that should render inside this slot.'
  }
]

interface DefinitionModule {
  default?: ComponentDefinition[]
  definitions?: ComponentDefinition[]
  getDefinitions?: () => ComponentDefinition[]
}

const projectDefinitionGlobs = {
  ...import.meta.glob<DefinitionModule>('~/content-builder/component-definitions.{ts,js,mjs,cjs}', {
    eager: true
  }),
  ...import.meta.glob<DefinitionModule>('~/content-builder/component-definitions/index.{ts,js,mjs,cjs}', {
    eager: true
  })
}

if (import.meta.dev) {
    console.log('[content-layer] projectDefinitionGlobs keys:',
        Object.keys(projectDefinitionGlobs))
}

const extractDefinitions = (module: DefinitionModule | undefined): ComponentDefinition[] => {
  if (!module) {
    return []
  }

  if (Array.isArray(module.default)) {
    return module.default
  }

  if (Array.isArray(module.definitions)) {
    return module.definitions
  }

  if (typeof module.getDefinitions === 'function') {
    try {
      const result = module.getDefinitions()
      return Array.isArray(result) ? result : []
    } catch (error) {
      if (import.meta.dev) {
        console.warn('[content-layer] Failed to resolve project component definitions:', error)
      }
    }
  }

  return []
}

const mergedDefinitions = (() => {
  const merged = new Map<string, ComponentDefinition>()

  for (const definition of defaultDefinitions) {
    merged.set(definition.id, definition)
  }

  for (const module of Object.values(projectDefinitionGlobs)) {
    const definitions = extractDefinitions(module)
    for (const definition of definitions) {
      if (!definition?.id) {
        continue
      }
      merged.set(definition.id, definition)
    }
  }

  return Array.from(merged.values())
})()

const lookup = mergedDefinitions.reduce<ComponentRegistry['lookup']>((acc, def) => {
  acc[def.id] = def
  return acc
}, {})

const registry: ComponentRegistry = {
  list: mergedDefinitions,
  lookup
}

const asRecord = (def?: ComponentDefinition) => {
  return (def?.props || []).reduce((acc, prop) => {
    if (prop.default !== undefined) {
      acc[prop.key] = prop.default
    }
    return acc
  }, {} as Record<string, unknown>)
}

const nextUid = (prefix: string) => {
  uidCounter += 1
  return `${prefix}-${uidCounter}`
}

export const useComponentRegistry = () => {
  const createNode = (component: string): BuilderNode => {
    const def = lookup[component]
    return {
      uid: nextUid('node'),
      type: 'component',
      component,
      props: asRecord(def),
      children: []
    }
  }

  const createTextNode = (value = ''): BuilderTextNode => ({
    uid: nextUid('text'),
    type: 'text',
    value
  })

  return {
    registry,
    createNode,
    createTextNode
  }
}
