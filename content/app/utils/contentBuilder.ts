import type {
  BuilderNode,
  BuilderNodeChild,
  BuilderTextNode,
  BuilderTree
} from '~/types/builder'

export type MinimalContentNode = [string, Record<string, any>, ...MinimalContentEntry[]]
export type MinimalContentEntry = MinimalContentNode | string

export type SpacingPresetId = 'none' | 'tight' | 'cozy' | 'roomy'

export interface PageConfigInput {
  path: string
  title: string
  seoTitle: string
  seoDescription: string
  navigation: boolean
  extension: string
  meta?: Record<string, any>
}

export interface MinimalContentDocument {
  id: string
  title: string
  layout?: {
    spacing?: SpacingPresetId
  }
  body: {
    type: 'minimal'
    value: MinimalContentEntry[]
  }
  extension: string
  meta: Record<string, any>
  navigation: boolean
  path: string
  seo: {
    title: string
    description: string
  }
  stem: string
}

const isTextNode = (node: BuilderNodeChild): node is BuilderTextNode => node.type === 'text'
const isComponentNode = (node: BuilderNodeChild): node is BuilderNode => node.type === 'component'

const serializeProps = (node: BuilderNode): Record<string, any> => {
  if (!node.props) {
    return {}
  }

  const props: Record<string, any> = {}

  for (const [key, value] of Object.entries(node.props)) {
    if (value === undefined || value === '') {
      continue
    }

    if (node.component === 'template' && key === 'slot') {
      props[`v-slot:${value}`] = ''
      continue
    }

    props[key] = value
  }

  return props
}

const serializeChildren = (nodes: BuilderNodeChild[]): MinimalContentEntry[] => {
  return nodes
    .map((child) => serializeNode(child))
    .filter((child): child is MinimalContentEntry => Boolean(child))
}

export const serializeNode = (node: BuilderNodeChild): MinimalContentEntry | null => {
  if (isTextNode(node)) {
    return node.value
  }

  if (!isComponentNode(node)) {
    return null
  }

  const props = serializeProps(node)
  const children = serializeChildren(node.children)

  if (children.length > 0) {
    return [node.component, Object.keys(props).length ? props : {}, ...children]
  }

  return [node.component, Object.keys(props).length ? props : {}]
}

export const serializeTree = (tree: BuilderTree): MinimalContentEntry[] => {
  return tree
    .map((node) => serializeNode(node))
    .filter((node): node is MinimalContentEntry => node !== null)
}

const normalizePath = (path: string): string => {
  const trimmed = (path || '/').trim()
  if (!trimmed) {
    return '/'
  }
  let normalized = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  if (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1)
  }
  return normalized || '/'
}

const pathToIdSegment = (path: string): string => {
  const normalized = normalizePath(path)
  if (normalized === '/') {
    return 'index'
  }
  return normalized.replace(/^\//, '')
}

const pathToStem = (path: string): string => {
  const segment = pathToIdSegment(path)
  const parts = segment.split('/')
  const tail = parts[parts.length - 1]
  return tail || 'index'
}

export const createDocumentFromTree = (
  tree: BuilderTree,
  config: PageConfigInput,
  layout?: MinimalContentDocument['layout']
): MinimalContentDocument => {
  const normalizedPath = normalizePath(config.path)
  const idSegment = pathToIdSegment(normalizedPath)

  return {
    id: `content/${idSegment}`,
    title: config.title,
    ...(layout ? { layout } : {}),
    body: {
      type: 'minimal',
      value: serializeTree(tree)
    },
    extension: config.extension,
    meta: config.meta ?? {},
    navigation: config.navigation,
    path: normalizedPath,
    seo: {
      title: config.seoTitle,
      description: config.seoDescription
    },
    stem: pathToStem(normalizedPath)
  }
}
