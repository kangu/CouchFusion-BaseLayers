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

const PARAGRAPH_COMPONENT_ID = 'p'
const PARAGRAPH_ALIGN_VALUES = ['left', 'center', 'right'] as const
type ParagraphAlignment = typeof PARAGRAPH_ALIGN_VALUES[number]
const DEFAULT_PARAGRAPH_ALIGN: ParagraphAlignment = 'left'

const isPlainObject = (value: unknown): value is Record<string, any> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const normaliseParagraphAlign = (value: unknown): ParagraphAlignment | null => {
  if (typeof value !== 'string') {
    return null
  }
  const normalized = value.trim().toLowerCase()
  return PARAGRAPH_ALIGN_VALUES.includes(normalized as ParagraphAlignment)
    ? (normalized as ParagraphAlignment)
    : null
}

const resolveParagraphAlign = (value: unknown): ParagraphAlignment => {
  return normaliseParagraphAlign(value) ?? DEFAULT_PARAGRAPH_ALIGN
}

const stripTextAlignStyle = (style: unknown): unknown => {
  if (typeof style === 'string') {
    const filtered = style
      .split(';')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0 && !entry.toLowerCase().startsWith('text-align'))

    if (filtered.length === 0) {
      return undefined
    }

    return filtered.join('; ')
  }

  if (isPlainObject(style)) {
    const cleaned: Record<string, any> = {}

    for (const [key, value] of Object.entries(style)) {
      if (key === 'textAlign' || key === 'text-align') {
        continue
      }
      cleaned[key] = value
    }

    return Object.keys(cleaned).length > 0 ? cleaned : undefined
  }

  return style
}

const appendTextAlignStyle = (style: unknown, align: Exclude<ParagraphAlignment, 'left'>): unknown => {
  if (isPlainObject(style)) {
    return {
      ...style,
      textAlign: align
    }
  }

  const base =
    typeof style === 'string' && style.trim().length > 0
      ? style.trim().replace(/;+$/, '')
      : ''

  const declaration = `text-align:${align}`

  return base.length > 0 ? `${base}; ${declaration}` : declaration
}

const normalizeComponentId = (component: string): string => {
  if (!component) {
    return component
  }

  if (component.includes('-')) {
    return component
  }

  return component
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .toLowerCase()
}

const serializeProps = (node: BuilderNode, componentName: string): Record<string, any> => {
  const props: Record<string, any> = {}

  for (const [key, value] of Object.entries(node.props || {})) {
    if (value === undefined || value === '') {
      continue
    }

    if (componentName === 'template' && key === 'slot') {
      props[`v-slot:${value}`] = ''
      continue
    }

    if (componentName === PARAGRAPH_COMPONENT_ID && key === 'align') {
      continue
    }

    props[key] = value
  }

  if (componentName === PARAGRAPH_COMPONENT_ID) {
    const align = resolveParagraphAlign(node.props?.align)
    let styleValue = stripTextAlignStyle(props.style)

    if (align !== DEFAULT_PARAGRAPH_ALIGN) {
      styleValue = appendTextAlignStyle(styleValue, align)
    }

    if (styleValue === undefined || (typeof styleValue === 'string' && styleValue.trim().length === 0)) {
      delete props.style
    } else {
      props.style = styleValue
    }
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

  const componentName = normalizeComponentId(node.component)
  const props = serializeProps(node, componentName)
  const children = serializeChildren(node.children)
  const baseEntry: MinimalContentEntry =
    children.length > 0
      ? [componentName, Object.keys(props).length ? props : {}, ...children]
      : [componentName, Object.keys(props).length ? props : {}]

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
