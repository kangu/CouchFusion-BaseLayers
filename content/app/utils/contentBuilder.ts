import type {
  BuilderNode,
  BuilderNodeChild,
  BuilderNodeMargins,
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
  const props: Record<string, any> = {}

  for (const [key, value] of Object.entries(node.props || {})) {
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

const isActiveMargin = (value?: string) => Boolean(value && value !== '0' && value !== 'none')

const hasMargins = (margins?: BuilderNodeMargins): boolean => {
  if (!margins) {
    return false
  }
  return (
    isActiveMargin(margins.top) ||
    isActiveMargin(margins.right) ||
    isActiveMargin(margins.bottom) ||
    isActiveMargin(margins.left)
  )
}

const buildMarginClasses = (margins?: BuilderNodeMargins): string[] => {
  if (!hasMargins(margins)) {
    return []
  }
  const classes: string[] = []
  if (isActiveMargin(margins?.top)) {
    classes.push(`mt-${margins.top}`)
  }
  if (isActiveMargin(margins?.right)) {
    classes.push(`mr-${margins.right}`)
  }
  if (isActiveMargin(margins?.bottom)) {
    classes.push(`mb-${margins.bottom}`)
  }
  if (isActiveMargin(margins?.left)) {
    classes.push(`ml-${margins.left}`)
  }
  return classes
}

const parseMarginClasses = (className: string): BuilderNodeMargins | null => {
  if (!className) {
    return null
  }
  const margins: BuilderNodeMargins = {}
  const classes = className.split(/\s+/)
  for (const token of classes) {
    if (token.startsWith('mt-')) {
      margins.top = token.replace('mt-', '')
    }
    if (token.startsWith('mr-')) {
      margins.right = token.replace('mr-', '')
    }
    if (token.startsWith('mb-')) {
      margins.bottom = token.replace('mb-', '')
    }
    if (token.startsWith('ml-')) {
      margins.left = token.replace('ml-', '')
    }
  }
  return hasMargins(margins) ? margins : null
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
  const baseEntry: MinimalContentEntry =
    children.length > 0
      ? [node.component, Object.keys(props).length ? props : {}, ...children]
      : [node.component, Object.keys(props).length ? props : {}]

  if (!hasMargins(node.margins)) {
    return baseEntry
  }

  const marginClasses = buildMarginClasses(node.margins)
  const wrapperProps = marginClasses.length ? { class: marginClasses.join(' ') } : {}

  return ['content-margin-wrapper', wrapperProps, baseEntry]
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
