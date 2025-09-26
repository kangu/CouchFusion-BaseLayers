import type { BuilderNode, BuilderTextNode, ComponentDefinition, ComponentRegistry } from '~/types/builder'

let uidCounter = 0

const definitions: ComponentDefinition[] = [
  {
    id: 'hero-section',
    label: 'Hero Section',
    description: 'Displays a prominent hero area with a title prop.',
    props: [
      {
        key: 'title',
        label: 'Title',
        type: 'text',
        required: true,
        placeholder: 'Enter headline text'
      }
    ]
  },
  {
    id: 'you-tube-embed',
    label: 'YouTube Embed',
    description: 'Embeds a YouTube video by ID.',
    props: [
      {
        key: 'video_id',
        label: 'Video ID',
        type: 'text',
        required: true,
        placeholder: 'dQw4w9WgXcQ'
      }
    ]
  },
  {
    id: 'p',
    label: 'Paragraph',
    description: 'Rich text paragraph wrapper. Combine with text nodes or inline elements.',
    allowChildren: true,
    childHint: 'Add text nodes or inline components as children.'
  },
  {
    id: 'span',
    label: 'Span',
    description: 'Inline span element.',
    allowChildren: true
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

const lookup = definitions.reduce<ComponentRegistry['lookup']>((acc, def) => {
  acc[def.id] = def
  return acc
}, {})

const registry: ComponentRegistry = {
  list: definitions,
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
