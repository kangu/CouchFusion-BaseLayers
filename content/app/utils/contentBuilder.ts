import type {
  BuilderNode,
  BuilderNodeChild,
  BuilderNodeMargins,
  BuilderMarginBreakpoint,
  BuilderResponsiveMargin,
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

const breakpoints: Array<{ key: BuilderMarginBreakpoint; prefix: string }> = [
  { key: 'base', prefix: '' },
  { key: 'sm', prefix: 'sm:' },
  { key: 'md', prefix: 'md:' },
  { key: 'lg', prefix: 'lg:' },
  { key: 'xl', prefix: 'xl:' }
]

const hasMargins = (margins?: BuilderNodeMargins): boolean => {
  if (!margins) {
    return false
  }
  const sides: Array<keyof BuilderNodeMargins> = ['top', 'right', 'bottom', 'left']
  return sides.some((side) => {
    const config = margins[side]
    return breakpoints.some((bp) => isActiveMargin(config?.[bp.key]))
  })
}

const buildMarginClasses = (margins?: BuilderNodeMargins): string[] => {
  if (!hasMargins(margins)) {
    return []
  }
  const classes: string[] = []

  const addClassesForSide = (config: BuilderResponsiveMargin | undefined, axis: 'pt' | 'pr' | 'pb' | 'pl') => {
    for (const { key, prefix } of breakpoints) {
      const value = config?.[key]
      if (isActiveMargin(value)) {
        const utility = `${axis}-${value}`
        classes.push(prefix ? `${prefix}${utility}` : utility)
      }
    }
  }

  addClassesForSide(margins?.top, 'pt')
  addClassesForSide(margins?.right, 'pr')
  addClassesForSide(margins?.bottom, 'pb')
  addClassesForSide(margins?.left, 'pl')

  return classes
}

const parseMarginClasses = (className: string): BuilderNodeMargins | null => {
  if (!className) {
    return null
  }
  const margins: BuilderNodeMargins = {}
  const prefixMap: Record<string, BuilderMarginBreakpoint> = {
    sm: 'sm',
    md: 'md',
    lg: 'lg',
    xl: 'xl'
  }

  for (const token of className.split(/\s+/)) {
    if (!token) {
      continue
    }
    const segments = token.split(':')
    const utility = segments.pop()
    if (!utility) {
      continue
    }
    const breakpointPrefix = segments.pop() ?? 'base'
    const breakpointKey = breakpointPrefix === 'base' ? 'base' : prefixMap[breakpointPrefix]
    if (!breakpointKey) {
      continue
    }
    const [axis, value] = utility.split('-')
    if (!value || !isActiveMargin(value)) {
      continue
    }
    let side: keyof BuilderNodeMargins | null = null
    if (axis === 'pt') {
      side = 'top'
    } else if (axis === 'pr') {
      side = 'right'
    } else if (axis === 'pb') {
      side = 'bottom'
    } else if (axis === 'pl') {
      side = 'left'
    }
    if (!side) {
      continue
    }
    if (!margins[side]) {
      margins[side] = {}
    }
    margins[side]![breakpointKey] = value
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
