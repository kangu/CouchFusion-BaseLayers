import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createError } from 'h3'
import { useRuntimeConfig } from '#imports'
import { getAllDocs } from '#database/utils/couchdb'
import type { ContentI18nConfig } from '#content/utils/i18n'
import { normalizeLocaleCode, resolveContentLocalePath } from '#content/utils/i18n'
import { normalizePagePath } from '#content/utils/page'
import { clonePlain, normalizePublicationState, normalizeSeoImage } from '#content/utils/page-documents'
import { parseContentPageRedirect } from '#content/utils/page-redirect'
import { canResolveContentRouteAccessForPath, normalizeContentRoutePath } from '#content/utils/route-access'
import { HTML_TAGS } from '#content/app/components/runtime/content/utils/htmlTags'
import { getContentDatabaseName } from './database'
import {
  buildLocaleDocumentIds,
  buildLocalizedBodyForRead,
  getBodyValue,
  getLocaleDocumentId,
  readContentDocumentLocalizationMeta,
  toPageDocumentRecord,
  valuesDeepEqual,
} from './content-i18n'
import { getEffectiveContentI18nConfig } from './content-i18n-settings'
import { getEffectiveGlobalComponentEntries } from './global-components-settings'
import { saveLocalizedPageDocument } from './content-pages-save'
import { renameContentPageUrl } from './content-page-url-rename'
import { setContentPagePublicationState } from './content-page-publication'
import { collectMinimarkTags, componentTagNames } from './component-usage'

/**
 * Page operations proposed by the LLM request job of the CouchFusion control plane
 * (contract: `cli-init/docs/superpowers/specs/2026-11-02-llm-request-contract.md`).
 *
 * `check` validates a proposal against the live content database without writing;
 * `apply` re-runs `check` and then writes with the layer's own helpers
 * (`saveLocalizedPageDocument`, `renameContentPageUrl`, `setContentPagePublicationState`).
 * Operations are validated in order against a simulated state, so a later operation
 * sees the effect of an earlier one (e.g. `page.update` on the target of a `page.move`).
 */

type Doc = Record<string, any>

export const MAX_OPERATIONS = 50
export const MAX_BODY_BYTES = 1_000_000
const MAX_LAYOUT_BYTES = 100_000
const MAX_TITLE_LENGTH = 500
const MAX_SEO_DESCRIPTION_LENGTH = 2_000
const MAX_MINIMARK_DEPTH = 200
const PREVIEW_MAX_LENGTH = 200
/** Same code the content middleware answers for a redirect page. */
const REDIRECT_STATUS = 308
const PRIMITIVE_TAGS = ['p', 'span', 'strong', 'template']
const OPERATION_NAMES = ['page.create', 'page.update', 'page.move', 'page.copyContent', 'page.publication'] as const

type OperationName = (typeof OPERATION_NAMES)[number]

export interface PageOperationProblem {
  index: number
  message: string
}

export interface PageOperationChange {
  field: string
  /** `null` for fields of a page that does not exist yet (`page.create`). */
  before: string | null
  after: string
}

export interface PageOperationPreview {
  index: number
  op: OperationName
  path: string
  locales: string[]
  changes: PageOperationChange[]
  from?: string
  to?: string
}

export interface PageOperationsCheckResult {
  ok: boolean
  problems: PageOperationProblem[]
  preview: PageOperationPreview[]
}

export interface PageOperationsRequest {
  operations: unknown[]
  baseRevs: Record<string, string>
}

interface SeoPatch {
  title?: string
  description?: string
  image?: string | null
}

type NormalizedOperation =
  | { op: 'page.create'; path: string; title: string; seo?: SeoPatch; body: unknown[]; layout?: Doc; publicationState: 'published' | 'draft' }
  | { op: 'page.update'; path: string; locale: string; title?: string; seo?: SeoPatch; body?: unknown[]; layout?: Doc }
  | { op: 'page.move'; from: string; to: string; keepRedirect: boolean }
  | { op: 'page.copyContent'; from: string; to: string }
  | { op: 'page.publication'; path: string; state: 'published' | 'draft' }

export interface LoadedPage {
  path: string
  /** Locale → raw CouchDB document (config locales only). */
  docs: Map<string, Doc>
}

interface PageState {
  config: ContentI18nConfig
  pages: Map<string, LoadedPage>
  /** Every loaded `page-*` document id → rev. */
  revs: Map<string, string>
}

/** One locale document in the simulated state used by `check`. */
interface SimDoc {
  id: string
  locale: string
  title: string | null
  seo: { title: string | null; description: string | null; image: string | null }
  layout: Doc
  body: unknown[]
  isNew: boolean
}

interface SimPage {
  path: string
  docs: Map<string, SimDoc>
  publicationState: 'published' | 'draft'
  redirect: { to: string; status: number } | null
}

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

const isPlainObject = (value: unknown): value is Record<string, any> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const docUpdatedAt = (doc: Doc): string =>
  typeof doc.updatedAt === 'string' ? doc.updatedAt : typeof doc.updated_at === 'string' ? doc.updated_at : ''

/**
 * Group page documents by base path and locale, the way the save helper resolves
 * them: the canonical id (`page-/x`, `page-/x::ro`) wins over a legacy root id
 * (`page-/`), otherwise the most recently updated document wins. `oldpage-*`
 * history and design documents are never part of the `page-` id range. Pages
 * without a default-locale document are dropped (as in `GET /api/content/pages`).
 */
export const groupPageDocuments = (docs: Doc[], config: ContentI18nConfig): Map<string, LoadedPage> => {
  const pages = new Map<string, LoadedPage>()

  for (const raw of docs) {
    const doc = toPageDocumentRecord(raw)
    const id = typeof doc?._id === 'string' ? doc._id : ''
    if (!doc || !id.startsWith('page-')) {
      continue
    }
    const meta = readContentDocumentLocalizationMeta(doc, config)
    if (!config.locales.includes(meta.locale)) {
      continue
    }
    const basePath = normalizePagePath(meta.basePath)
    let page = pages.get(basePath)
    if (!page) {
      page = { path: basePath, docs: new Map() }
      pages.set(basePath, page)
    }
    const existing = page.docs.get(meta.locale)
    const canonicalId = getLocaleDocumentId(basePath, meta.locale, config)
    const prefer = !existing
      || (id === canonicalId && existing._id !== canonicalId)
      || (existing._id !== canonicalId && docUpdatedAt(doc) >= docUpdatedAt(existing))
    if (prefer) {
      page.docs.set(meta.locale, doc)
    }
  }

  for (const [path, page] of pages) {
    if (!page.docs.has(config.defaultLocale)) {
      pages.delete(path)
    }
  }

  return pages
}

const PAGE_ID_RANGE = { startkey: 'page-', endkey: 'page-￰' }

const loadPageState = async (): Promise<PageState> => {
  const { effective: config } = await getEffectiveContentI18nConfig()
  const response = await getAllDocs(getContentDatabaseName(), { ...PAGE_ID_RANGE, include_docs: true })
  if (!response) {
    throw createError({ statusCode: 503, statusMessage: 'Content database unavailable' })
  }
  const docs = (Array.isArray(response.rows) ? response.rows : [])
    .map((row: any) => row?.doc as Doc | undefined)
    .filter((doc): doc is Doc => Boolean(doc))
  const revs = new Map<string, string>()
  for (const doc of docs) {
    if (typeof doc._id === 'string' && doc._id.startsWith('page-') && typeof doc._rev === 'string') {
      revs.set(doc._id, doc._rev)
    }
  }
  return { config, pages: groupPageDocuments(docs, config), revs }
}

/** All document ids a page can occupy, including the legacy root ids. */
export const pageDocumentIds = (path: string, config: ContentI18nConfig): string[] => {
  const ids = buildLocaleDocumentIds(path, config)
  if (normalizePagePath(path) === '/') {
    for (const locale of config.locales) {
      ids.push(locale === config.defaultLocale ? 'page-/' : `page-/::${locale}`)
    }
  }
  return Array.from(new Set(ids))
}

const masterOf = (page: LoadedPage, config: ContentI18nConfig): Doc => page.docs.get(config.defaultLocale)!

/** The body a locale shows in the builder: master values at fixed paths merged in. */
const readLocaleBody = (page: LoadedPage, locale: string, config: ContentI18nConfig): unknown[] => {
  const master = masterOf(page, config)
  const doc = page.docs.get(locale)
  if (!doc || locale === config.defaultLocale) {
    return getBodyValue(master)
  }
  const fixedBodyPaths = readContentDocumentLocalizationMeta(master, config).fixedBodyPaths
  const merged = buildLocalizedBodyForRead(getBodyValue(master), getBodyValue(doc), fixedBodyPaths)
  return Array.isArray(merged) ? merged : []
}

const redirectOfDoc = (doc: Doc, path: string): { to: string; status: number } | null => {
  const parsed = parseContentPageRedirect(doc.meta, path)
  if (parsed.status === 'valid') {
    return { to: parsed.targetPath, status: REDIRECT_STATUS }
  }
  if (parsed.status === 'invalid') {
    // The middleware answers 404 for a misconfigured redirect.
    return { to: String(doc.meta?.redirectTo ?? ''), status: 404 }
  }
  return null
}

const redirectOfPage = (page: LoadedPage, config: ContentI18nConfig): { to: string; status: number } | null => {
  const master = masterOf(page, config)
  const ordered = [master, ...Array.from(page.docs.values()).filter((doc) => doc !== master)]
  for (const doc of ordered) {
    const redirect = redirectOfDoc(doc, page.path)
    if (redirect) {
      return redirect
    }
  }
  return null
}

const presentLocales = (docs: Map<string, unknown>, config: ContentI18nConfig): string[] =>
  config.locales.filter((locale) => docs.has(locale))

// ---------------------------------------------------------------------------
// GET routes
// ---------------------------------------------------------------------------

/** `GET /__couchfusion/control/pages` */
export const listControlPages = async () => {
  const state = await loadPageState()
  const pages = Array.from(state.pages.values())
    .map((page) => {
      const master = masterOf(page, state.config)
      const updatedAt = Array.from(page.docs.values())
        .map(docUpdatedAt)
        .filter(Boolean)
        .sort()
        .pop() ?? null
      return {
        path: page.path,
        title: typeof master.title === 'string' ? master.title : null,
        publicationState: normalizePublicationState(master.publicationState),
        locales: presentLocales(page.docs, state.config),
        redirect: redirectOfPage(page, state.config),
        updatedAt,
      }
    })
    .sort((left, right) => left.path.localeCompare(right.path))

  return {
    defaultLocale: state.config.defaultLocale,
    locales: [...state.config.locales],
    pages,
  }
}

/** `GET /__couchfusion/control/page-documents?path=…|all=1` */
export const getControlPageDocuments = async (input: { paths: string[]; all: boolean }) => {
  const state = await loadPageState()
  const { config } = state
  const requested = input.all
    ? Array.from(state.pages.keys()).sort((left, right) => left.localeCompare(right))
    : Array.from(new Set(input.paths.map((path) => normalizePagePath(path))))

  return {
    pages: requested.map((path) => {
      const page = state.pages.get(path)
      if (!page) {
        return { path, documents: [] }
      }
      const master = masterOf(page, config)
      const publicationState = normalizePublicationState(master.publicationState)
      return {
        path,
        documents: presentLocales(page.docs, config).map((locale) => {
          const doc = page.docs.get(locale)!
          return {
            locale,
            id: doc._id,
            rev: doc._rev ?? null,
            title: typeof doc.title === 'string' ? doc.title : null,
            seo: {
              title: typeof doc.seo?.title === 'string' ? doc.seo.title : null,
              description: typeof doc.seo?.description === 'string' ? doc.seo.description : null,
              image: normalizeSeoImage(doc.seo?.image),
            },
            publicationState,
            layout: isPlainObject(doc.layout) ? clonePlain(doc.layout) : { spacing: 'none' },
            body: { type: 'minimal', value: clonePlain(readLocaleBody(page, locale, config)) },
          }
        }),
      }
    }),
  }
}

// ---------------------------------------------------------------------------
// Component validation
// ---------------------------------------------------------------------------

export interface KnownComponents {
  /** False when no registry manifest could be read. */
  registryAvailable: boolean
  /** Registry ids, PascalCase and camelCase aliases. */
  registryTags: Set<string>
  /** Enabled global component alias ids (matched exactly, as the renderer does). */
  globalAliases: Set<string>
}

const REGISTRY_MANIFEST_RELATIVE = ['app/content-builder/component-definitions.json', 'content-builder/component-definitions.json']

/**
 * Manifest candidates: the paths the module computed from the app's `srcDir`/`rootDir`
 * (`runtimeConfig.content.controlPlaneRegistryManifests`), then the dev server's cwd.
 */
const registryManifestCandidates = (): string[] => {
  const configured = (useRuntimeConfig() as any)?.content?.controlPlaneRegistryManifests
  const list = Array.isArray(configured)
    ? configured.filter((entry: unknown): entry is string => typeof entry === 'string' && entry.length > 0)
    : []
  return Array.from(new Set([...list, ...REGISTRY_MANIFEST_RELATIVE.map((entry) => resolve(process.cwd(), entry))]))
}

const toCamelCase = (kebab: string): string => {
  const pascal = componentTagNames(kebab)[1] ?? kebab
  return pascal.charAt(0).toLowerCase() + pascal.slice(1)
}

/**
 * Read the app's generated registry manifest (`component-definitions.json`, written
 * next to the `.ts` registry by `content-registry`) — the same list the builder's
 * picker offers as project components.
 */
export const loadRegistryComponentIds = async (): Promise<string[] | null> => {
  for (const candidate of registryManifestCandidates()) {
    try {
      const parsed = JSON.parse(await readFile(candidate, 'utf8'))
      if (!Array.isArray(parsed?.components)) {
        continue
      }
      return parsed.components
        .map((entry: any) => (typeof entry?.id === 'string' ? entry.id.trim() : ''))
        .filter(Boolean)
    } catch {
      // try the next candidate
    }
  }
  return null
}

export const loadKnownComponents = async (): Promise<KnownComponents> => {
  const [ids, globals] = await Promise.all([loadRegistryComponentIds(), getEffectiveGlobalComponentEntries()])
  const registryTags = new Set<string>()
  for (const id of ids ?? []) {
    for (const name of [...componentTagNames(id), toCamelCase(id)]) {
      registryTags.add(name)
    }
  }
  return {
    registryAvailable: ids !== null,
    registryTags,
    globalAliases: new Set(globals.filter((entry) => entry.enabled !== false).map((entry) => entry.id)),
  }
}

/** Plain HTML/SVG tags and the builder primitives (`p`, `span`, `strong`, `template`). */
export const isBuiltInTag = (tag: string): boolean => {
  const lower = tag.trim().toLowerCase()
  return HTML_TAGS.has(lower) || PRIMITIVE_TAGS.includes(lower)
}

export const isKnownComponentTag = (tag: string, known: KnownComponents): boolean =>
  isBuiltInTag(tag) || known.registryTags.has(tag) || known.globalAliases.has(tag)

/** Component (non-HTML) tags of a body, in first-seen order. */
export const bodyComponentTags = (body: unknown[]): string[] =>
  collectMinimarkTags(body).filter((tag) => !isBuiltInTag(tag))

const TAG_PATTERN = /^[A-Za-z][A-Za-z0-9_.:-]*$/

/** Returns an error message for an invalid minimark entry list, or null. */
export const validateMinimarkBody = (value: unknown): string | null => {
  const visit = (node: unknown, location: string, depth: number): string | null => {
    if (depth > MAX_MINIMARK_DEPTH) {
      return `Body is nested deeper than ${MAX_MINIMARK_DEPTH} levels`
    }
    if (typeof node === 'string') {
      return null
    }
    if (!Array.isArray(node) || node.length === 0) {
      return `Invalid body node at ${location}: expected [tag, props, ...children] or text`
    }
    const [tag, maybeProps] = node
    if (typeof tag !== 'string' || !TAG_PATTERN.test(tag)) {
      return `Invalid tag at ${location}`
    }
    // `[tag, props?, ...children]`: anything after the tag that is not a props
    // object is a child and must itself be text or an element.
    const childStart = isPlainObject(maybeProps) ? 2 : 1
    for (let index = childStart; index < node.length; index += 1) {
      const error = visit(node[index], `${location}[${index}]`, depth + 1)
      if (error) {
        return error
      }
    }
    return null
  }

  if (!Array.isArray(value)) {
    return 'body.value must be an array'
  }
  for (let index = 0; index < value.length; index += 1) {
    const error = visit(value[index], `value[${index}]`, 1)
    if (error) {
      return error
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// Preview strings
// ---------------------------------------------------------------------------

export const truncatePreview = (value: string, max = PREVIEW_MAX_LENGTH): string =>
  value.length > max ? `${value.slice(0, max - 1)}…` : value

const kebabKey = (tag: string): string =>
  tag.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/([A-Z])([A-Z][a-z])/g, '$1-$2').toLowerCase()

/** "5 blocks: HeroBanner, TextBlock, …" — top-level entries of a body. */
export const describeBodyOutline = (body: unknown[]): string => {
  const names = body
    .filter((entry) => !(typeof entry === 'string' && !entry.trim()))
    .map((entry) => (Array.isArray(entry) && typeof entry[0] === 'string' ? entry[0] : 'text'))
  if (names.length === 0) {
    return 'empty'
  }
  return truncatePreview(`${names.length} ${names.length === 1 ? 'block' : 'blocks'}: ${names.join(', ')}`)
}

/** Component tags present in `after` but not `before` (and vice versa), alias-insensitive. */
export const diffBodyComponents = (before: unknown[], after: unknown[]) => {
  const beforeTags = bodyComponentTags(before)
  const afterTags = bodyComponentTags(after)
  const beforeKeys = new Set(beforeTags.map(kebabKey))
  const afterKeys = new Set(afterTags.map(kebabKey))
  return {
    added: afterTags.filter((tag) => !beforeKeys.has(kebabKey(tag))),
    removed: beforeTags.filter((tag) => !afterKeys.has(kebabKey(tag))),
  }
}

/** `body` (and `body.components` when components were added/removed); `suffix` names a locale. */
const bodyChanges = (before: unknown[], after: unknown[], suffix = ''): PageOperationChange[] => {
  if (valuesDeepEqual(before, after)) {
    return []
  }
  const beforeOutline = describeBodyOutline(before)
  let afterOutline = describeBodyOutline(after)
  if (afterOutline === beforeOutline) {
    afterOutline = truncatePreview(`${afterOutline} (content changed)`)
  }
  const changes: PageOperationChange[] = [{ field: `body${suffix}`, before: beforeOutline, after: afterOutline }]
  const { added, removed } = diffBodyComponents(before, after)
  if (added.length || removed.length) {
    changes.push({
      field: `body.components${suffix}`,
      before: truncatePreview(`removed: ${removed.length ? removed.join(', ') : 'none'}`),
      after: truncatePreview(`added: ${added.length ? added.join(', ') : 'none'}`),
    })
  }
  return changes
}

const shortText = (value: string | null | undefined): string =>
  typeof value === 'string' && value.length ? truncatePreview(value) : '(none)'

const shortJson = (value: unknown): string => {
  try {
    return truncatePreview(JSON.stringify(value) ?? 'null')
  } catch {
    return '(unprintable)'
  }
}

const textChange = (field: string, before: string | null, after: string | null): PageOperationChange[] =>
  before === after ? [] : [{ field, before: shortText(before), after: shortText(after) }]

// ---------------------------------------------------------------------------
// Check
// ---------------------------------------------------------------------------

const toSimPage = (page: LoadedPage, config: ContentI18nConfig): SimPage => {
  const docs = new Map<string, SimDoc>()
  for (const locale of presentLocales(page.docs, config)) {
    const doc = page.docs.get(locale)!
    docs.set(locale, {
      id: doc._id,
      locale,
      title: typeof doc.title === 'string' ? doc.title : null,
      seo: {
        title: typeof doc.seo?.title === 'string' ? doc.seo.title : null,
        description: typeof doc.seo?.description === 'string' ? doc.seo.description : null,
        image: normalizeSeoImage(doc.seo?.image),
      },
      layout: isPlainObject(doc.layout) ? clonePlain(doc.layout) : { spacing: 'none' },
      body: clonePlain(readLocaleBody(page, locale, config)),
      isNew: false,
    })
  }
  return {
    path: page.path,
    docs,
    publicationState: normalizePublicationState(masterOf(page, config).publicationState),
    redirect: redirectOfPage(page, config),
  }
}

const byteLength = (value: unknown): number => {
  try {
    return Buffer.byteLength(JSON.stringify(value) ?? '', 'utf8')
  } catch {
    return Number.POSITIVE_INFINITY
  }
}

const ALLOWED_FIELDS: Record<OperationName, string[]> = {
  'page.create': ['op', 'path', 'title', 'seo', 'body', 'layout', 'publicationState'],
  'page.update': ['op', 'path', 'locale', 'title', 'seo', 'body', 'layout'],
  'page.move': ['op', 'from', 'to', 'keepRedirect'],
  'page.copyContent': ['op', 'from', 'to'],
  'page.publication': ['op', 'path', 'state'],
}

type ParsedPath = { path: string } | { error: string }

const parseBasePath = (value: unknown, field: string, config: ContentI18nConfig): ParsedPath => {
  const path = normalizeContentRoutePath(value)
  if (!path) {
    return { error: `${field} must be an internal path starting with /` }
  }
  const resolved = resolveContentLocalePath(path, config)
  if (resolved.hasLocalePrefix) {
    return { error: `${field} ${path} includes the locale prefix "${resolved.locale}"; use the base path ${resolved.basePath}` }
  }
  return { path: normalizePagePath(path) }
}

/** `title`, `seo`, `body`, `layout` as shared by `page.create` and `page.update`. */
const parseContentFields = (
  raw: Record<string, any>,
  op: { title?: string; seo?: SeoPatch; body?: unknown[]; layout?: Doc },
  errors: string[],
): void => {
  if (raw.title !== undefined) {
    if (typeof raw.title !== 'string' || !raw.title.trim()) {
      errors.push('title must be a non-empty string')
    } else if (raw.title.length > MAX_TITLE_LENGTH) {
      errors.push(`title is longer than ${MAX_TITLE_LENGTH} characters`)
    } else {
      op.title = raw.title
    }
  }
  if (raw.seo !== undefined) {
    if (!isPlainObject(raw.seo)) {
      errors.push('seo must be an object')
    } else {
      const seo: SeoPatch = {}
      for (const key of Object.keys(raw.seo)) {
        if (!['title', 'description', 'image'].includes(key)) {
          errors.push(`Unknown seo field "${key}"`)
        }
      }
      for (const key of ['title', 'description'] as const) {
        const value = raw.seo[key]
        if (value === undefined || value === null) {
          continue
        }
        if (typeof value !== 'string') {
          errors.push(`seo.${key} must be a string`)
        } else if (value.length > (key === 'title' ? MAX_TITLE_LENGTH : MAX_SEO_DESCRIPTION_LENGTH)) {
          errors.push(`seo.${key} is too long`)
        } else {
          seo[key] = value
        }
      }
      if ('image' in raw.seo) {
        const image = raw.seo.image
        if (image === null || image === '') {
          seo.image = null
        } else if (typeof image !== 'string' || !normalizeSeoImage(image)) {
          errors.push('seo.image must be an absolute http(s) URL or null')
        } else {
          seo.image = normalizeSeoImage(image)
        }
      }
      op.seo = seo
    }
  }
  if (raw.body !== undefined) {
    if (!isPlainObject(raw.body) || raw.body.type !== 'minimal' || !Array.isArray(raw.body.value)) {
      errors.push('body must be { "type": "minimal", "value": [ … ] }')
    } else if (byteLength(raw.body) > MAX_BODY_BYTES) {
      errors.push('Body is larger than 1 MB')
    } else {
      const error = validateMinimarkBody(raw.body.value)
      if (error) {
        errors.push(error)
      } else {
        op.body = clonePlain(raw.body.value)
      }
    }
  }
  if (raw.layout !== undefined) {
    if (!isPlainObject(raw.layout)) {
      errors.push('layout must be an object')
    } else if (byteLength(raw.layout) > MAX_LAYOUT_BYTES) {
      errors.push('layout is too large')
    } else {
      op.layout = clonePlain(raw.layout)
    }
  }
}

/** Shape-only parsing of one operation (no database state). */
const parseOperation = (
  raw: unknown,
  config: ContentI18nConfig,
): { op: NormalizedOperation } | { errors: string[] } => {
  if (!isPlainObject(raw)) {
    return { errors: ['Operation must be an object'] }
  }
  const name = raw.op
  if (typeof name !== 'string' || !(OPERATION_NAMES as readonly string[]).includes(name)) {
    return { errors: [`Unknown operation ${typeof name === 'string' ? `"${name}"` : '(missing op)'}`] }
  }
  const opName = name as OperationName
  const errors: string[] = []
  for (const key of Object.keys(raw)) {
    if (!ALLOWED_FIELDS[opName].includes(key)) {
      errors.push(`Unknown field "${key}" for ${opName}`)
    }
  }

  const pathField = (field: string): string | null => {
    const parsed = parseBasePath(raw[field], field, config)
    if ('error' in parsed) {
      errors.push(parsed.error)
      return null
    }
    return parsed.path
  }

  if (opName === 'page.create') {
    const path = pathField('path')
    if (path && !canResolveContentRouteAccessForPath(path)) {
      errors.push(`${path} is not a valid content page path`)
    }
    if (raw.title === undefined) {
      errors.push('page.create needs a title')
    }
    if (raw.body === undefined) {
      errors.push('page.create needs a body')
    }
    let publicationState: 'published' | 'draft' = 'draft'
    if (raw.publicationState !== undefined && raw.publicationState !== null) {
      if (raw.publicationState !== 'published' && raw.publicationState !== 'draft') {
        errors.push('publicationState must be "published" or "draft"')
      } else {
        publicationState = raw.publicationState
      }
    }
    const fields: { title?: string; seo?: SeoPatch; body?: unknown[]; layout?: Doc } = {}
    parseContentFields(raw, fields, errors)
    if (errors.length || !path || fields.title === undefined || !fields.body) {
      return { errors: errors.length ? errors : ['Invalid page.create'] }
    }
    return { op: { op: 'page.create', path, title: fields.title, seo: fields.seo, body: fields.body, layout: fields.layout, publicationState } }
  }

  if (opName === 'page.update') {
    const path = pathField('path')
    let locale = config.defaultLocale
    if (raw.locale !== undefined && raw.locale !== null) {
      const requested = normalizeLocaleCode(raw.locale)
      if (!requested || !config.locales.includes(requested)) {
        errors.push(`Unknown locale ${JSON.stringify(raw.locale)} (locales: ${config.locales.join(', ')})`)
      } else {
        locale = requested
      }
    }
    const op: Extract<NormalizedOperation, { op: 'page.update' }> = { op: 'page.update', path: path ?? '/', locale }
    parseContentFields(raw, op, errors)
    if (raw.title === undefined && raw.seo === undefined && raw.body === undefined && raw.layout === undefined) {
      errors.push('page.update needs at least one of title, seo, body, layout')
    }
    return errors.length ? { errors } : { op }
  }

  if (opName === 'page.move') {
    const from = pathField('from')
    const to = pathField('to')
    if (typeof raw.keepRedirect !== 'boolean') {
      errors.push('keepRedirect must be true or false')
    }
    if (from && to && from === to) {
      errors.push('from and to must be different paths')
    }
    if (from === '/') {
      errors.push('The home page cannot be moved')
    }
    if (to && !canResolveContentRouteAccessForPath(to)) {
      errors.push(`${to} is not a valid content page path`)
    }
    return errors.length ? { errors } : { op: { op: 'page.move', from: from!, to: to!, keepRedirect: raw.keepRedirect as boolean } }
  }

  if (opName === 'page.copyContent') {
    const from = pathField('from')
    const to = pathField('to')
    if (from && to && from === to) {
      errors.push('from and to must be different paths')
    }
    return errors.length ? { errors } : { op: { op: 'page.copyContent', from: from!, to: to! } }
  }

  const path = pathField('path')
  if (raw.state !== 'published' && raw.state !== 'draft') {
    errors.push('state must be "published" or "draft"')
  }
  return errors.length ? { errors } : { op: { op: 'page.publication', path: path!, state: raw.state as 'published' | 'draft' } }
}

/** Validate the request envelope; malformed envelopes are a 400, not a check problem. */
export const parsePageOperationsRequest = (raw: unknown): PageOperationsRequest => {
  if (!isPlainObject(raw) || !Array.isArray(raw.operations)) {
    throw createError({ statusCode: 400, statusMessage: 'Body must be { operations: [...], baseRevs: {...} }' })
  }
  if (raw.operations.length > MAX_OPERATIONS) {
    throw createError({ statusCode: 400, statusMessage: `At most ${MAX_OPERATIONS} operations are allowed` })
  }
  const baseRevs: Record<string, string> = {}
  if (raw.baseRevs !== undefined && raw.baseRevs !== null) {
    if (!isPlainObject(raw.baseRevs)) {
      throw createError({ statusCode: 400, statusMessage: 'baseRevs must be an object of document id → rev' })
    }
    for (const [id, rev] of Object.entries(raw.baseRevs)) {
      if (typeof rev !== 'string') {
        throw createError({ statusCode: 400, statusMessage: 'baseRevs must be an object of document id → rev' })
      }
      baseRevs[id] = rev
    }
  }
  return { operations: raw.operations, baseRevs }
}

interface CheckRun {
  result: PageOperationsCheckResult
  state: PageState
  operations: NormalizedOperation[]
}

const runCheck = async (request: PageOperationsRequest): Promise<CheckRun> => {
  const state = await loadPageState()
  const { config } = state
  const problems: PageOperationProblem[] = []
  const preview: PageOperationPreview[] = []
  const normalized: NormalizedOperation[] = []
  const sim = new Map<string, SimPage>()
  for (const [path, page] of state.pages) {
    sim.set(path, toSimPage(page, config))
  }

  let known: KnownComponents | null = null
  const ensureKnown = async () => (known ??= await loadKnownComponents())

  const label = (path: string, locale: string) => `Page ${path} (${locale})`

  /** baseRevs: each written document must still have the rev the request ran against. */
  const checkRevs = (index: number, entries: Array<{ id: string; path: string; locale: string }>) => {
    const reported = new Set<string>()
    for (const { id, path, locale } of entries) {
      if (reported.has(id) || !(id in request.baseRevs)) {
        continue
      }
      const current = state.revs.get(id) ?? null
      if (current !== request.baseRevs[id]) {
        reported.add(id)
        problems.push({ index, message: `${label(path, locale)} changed since the request ran.` })
      }
    }
  }

  const docEntries = (page: SimPage) =>
    Array.from(page.docs.values()).map((doc) => ({ id: doc.id, path: page.path, locale: doc.locale }))

  /** Ids an earlier `page.move` without redirect deletes. */
  const vacated = new Set<string>()
  const targetOccupied = (path: string) =>
    sim.has(path) || pageDocumentIds(path, config).some((id) => state.revs.has(id) && !vacated.has(id))

  /** Component tags in `body` that `baseline` does not already use must be known. */
  const validateBodyComponents = async (index: number, body: unknown[], baseline: unknown[]) => {
    const existing = new Set(bodyComponentTags(baseline))
    const introduced = bodyComponentTags(body).filter((tag) => !existing.has(tag))
    if (!introduced.length) {
      return
    }
    const components = await ensureKnown()
    for (const tag of introduced) {
      if (isKnownComponentTag(tag, components)) {
        continue
      }
      problems.push({
        index,
        message: components.registryAvailable
          ? `Unknown component ${tag} in body`
          : `Unknown component ${tag} in body (component registry component-definitions.json not found; cannot validate)`,
      })
    }
  }

  for (let index = 0; index < request.operations.length; index += 1) {
    const parsed = parseOperation(request.operations[index], config)
    if ('errors' in parsed) {
      for (const message of parsed.errors) {
        problems.push({ index, message })
      }
      continue
    }
    const op = parsed.op
    normalized.push(op)

    if (op.op === 'page.create') {
      // Occupied = an existing page, a page created/moved here earlier in this
      // proposal, or any leftover document id of that path (as the move check).
      if (targetOccupied(op.path)) {
        problems.push({ index, message: `Page ${op.path} already exists` })
        continue
      }
      // A new page has no existing body: every non-HTML tag must be a known component.
      await validateBodyComponents(index, op.body, [])
      // What `sanitiseIncomingDocument` stores for a create without/with partial seo.
      const seo = {
        title: op.seo?.title ?? op.title,
        description: op.seo?.description ?? 'SEO description.',
        image: op.seo?.image ?? null,
      }
      const layout = op.layout ? clonePlain(op.layout) : { spacing: 'none' }
      const doc: SimDoc = {
        id: getLocaleDocumentId(op.path, config.defaultLocale, config),
        locale: config.defaultLocale,
        title: op.title,
        seo,
        layout,
        body: clonePlain(op.body),
        isNew: true,
      }
      const changes: PageOperationChange[] = [
        { field: 'path', before: null, after: op.path },
        { field: 'title', before: null, after: shortText(op.title) },
        { field: 'seo.title', before: null, after: shortText(seo.title) },
        { field: 'seo.description', before: null, after: shortText(seo.description) },
        { field: 'seo.image', before: null, after: shortText(seo.image) },
        { field: 'publicationState', before: null, after: op.publicationState },
        { field: 'body', before: null, after: describeBodyOutline(op.body) },
      ]
      if (op.layout) {
        changes.push({ field: 'layout', before: null, after: shortJson(layout) })
      }
      preview.push({ index, op: op.op, path: op.path, locales: [config.defaultLocale], changes })
      for (const id of pageDocumentIds(op.path, config)) {
        vacated.delete(id)
      }
      sim.set(op.path, {
        path: op.path,
        docs: new Map([[config.defaultLocale, doc]]),
        publicationState: op.publicationState,
        redirect: null,
      })
      continue
    }

    if (op.op === 'page.update') {
      const page = sim.get(op.path)
      if (!page) {
        problems.push({ index, message: `Page ${op.path} not found` })
        continue
      }
      if (page.redirect) {
        problems.push({ index, message: `Page ${op.path} is a redirect to ${page.redirect.to}; edit that page instead` })
        continue
      }
      const master = page.docs.get(config.defaultLocale)!
      const existing = page.docs.get(op.locale)
      const current: SimDoc = existing ?? {
        ...clonePlain(master),
        id: getLocaleDocumentId(op.path, op.locale, config),
        locale: op.locale,
        isNew: true,
      }

      if (op.body) {
        await validateBodyComponents(index, op.body, current.body)
      }

      // Documents the save may write: the locale document; with a body, every locale
      // (fixed body paths propagate between master and translations); a new
      // translation is based on the master.
      const written = op.body
        ? docEntries(page)
        : [{ id: current.id, path: page.path, locale: op.locale }, ...(existing ? [] : [{ id: master.id, path: page.path, locale: config.defaultLocale }])]
      checkRevs(index, written)

      const next: SimDoc = clonePlain(current)
      if (op.title !== undefined) next.title = op.title
      if (op.seo) {
        if (op.seo.title !== undefined) next.seo.title = op.seo.title
        if (op.seo.description !== undefined) next.seo.description = op.seo.description
        if ('image' in op.seo) next.seo.image = op.seo.image ?? null
      }
      if (op.body) next.body = clonePlain(op.body)
      if (op.layout) next.layout = clonePlain(op.layout)

      const changes: PageOperationChange[] = []
      if (current.isNew) {
        changes.push({ field: 'document', before: `(no ${op.locale} document)`, after: `new ${op.locale} translation` })
      }
      changes.push(...textChange('title', current.title, next.title))
      changes.push(...textChange('seo.title', current.seo.title, next.seo.title))
      changes.push(...textChange('seo.description', current.seo.description, next.seo.description))
      changes.push(...textChange('seo.image', current.seo.image, next.seo.image))
      changes.push(...bodyChanges(current.body, next.body))
      if (!valuesDeepEqual(current.layout, next.layout)) {
        changes.push({ field: 'layout', before: shortJson(current.layout), after: shortJson(next.layout) })
      }
      preview.push({ index, op: op.op, path: op.path, locales: [op.locale], changes })
      page.docs.set(op.locale, { ...next, isNew: false })
      continue
    }

    if (op.op === 'page.move') {
      const page = sim.get(op.from)
      if (!page) {
        problems.push({ index, message: `Page ${op.from} not found` })
        continue
      }
      let blocked = false
      if (page.redirect) {
        problems.push({ index, message: `Page ${op.from} is a redirect and cannot be moved` })
        blocked = true
      }
      if (targetOccupied(op.to)) {
        problems.push({ index, message: `Target ${op.to} already exists` })
        blocked = true
      }
      if (blocked) {
        continue
      }
      checkRevs(index, [
        ...docEntries(page),
        ...config.locales.map((locale) => ({ id: getLocaleDocumentId(op.to, locale, config), path: op.to, locale })),
      ])
      const locales = presentLocales(page.docs, config)
      preview.push({
        index,
        op: op.op,
        path: op.from,
        from: op.from,
        to: op.to,
        locales,
        changes: [
          { field: 'path', before: op.from, after: op.to },
          { field: 'redirect', before: 'none', after: op.keepRedirect ? `${op.from} → ${op.to} (${REDIRECT_STATUS})` : 'none (old URL removed)' },
        ],
      })
      const moved: SimPage = { ...page, path: op.to, docs: new Map() }
      for (const [locale, doc] of page.docs) {
        moved.docs.set(locale, { ...doc, id: getLocaleDocumentId(op.to, locale, config), isNew: true })
      }
      for (const doc of moved.docs.values()) {
        vacated.delete(doc.id)
      }
      sim.delete(op.from)
      sim.set(op.to, moved)
      if (!op.keepRedirect) {
        for (const doc of page.docs.values()) {
          vacated.add(doc.id)
        }
      } else {
        const redirect: SimPage = {
          path: op.from,
          docs: new Map(),
          publicationState: 'published',
          redirect: { to: op.to, status: REDIRECT_STATUS },
        }
        for (const [locale, doc] of page.docs) {
          redirect.docs.set(locale, { ...doc, title: null, body: [], layout: { spacing: 'none' }, seo: { title: null, description: null, image: null } })
        }
        sim.set(op.from, redirect)
      }
      continue
    }

    if (op.op === 'page.copyContent') {
      const source = sim.get(op.from)
      const target = sim.get(op.to)
      let blocked = false
      if (!source) {
        problems.push({ index, message: `Page ${op.from} not found` })
        blocked = true
      } else if (source.redirect) {
        problems.push({ index, message: `Page ${op.from} is a redirect to ${source.redirect.to}; copy from that page instead` })
        blocked = true
      }
      if (!target) {
        problems.push({ index, message: `Page ${op.to} not found` })
        blocked = true
      } else if (target.redirect) {
        problems.push({ index, message: `Page ${op.to} is a redirect to ${target.redirect.to}; its content is never shown` })
        blocked = true
      }
      if (blocked || !source || !target) {
        continue
      }
      checkRevs(index, [...docEntries(target), ...docEntries(source)])
      const changes: PageOperationChange[] = []
      const locales = presentLocales(target.docs, config)
      for (const locale of locales) {
        const targetDoc = target.docs.get(locale)!
        const sourceDoc = source.docs.get(locale) ?? source.docs.get(config.defaultLocale)!
        const suffix = locales.length > 1 ? ` (${locale})` : ''
        changes.push(...bodyChanges(targetDoc.body, sourceDoc.body, suffix))
        if (!valuesDeepEqual(targetDoc.layout, sourceDoc.layout)) {
          changes.push({ field: `layout${suffix}`, before: shortJson(targetDoc.layout), after: shortJson(sourceDoc.layout) })
        }
        target.docs.set(locale, { ...targetDoc, body: clonePlain(sourceDoc.body), layout: clonePlain(sourceDoc.layout) })
      }
      preview.push({ index, op: op.op, path: op.to, from: op.from, to: op.to, locales, changes })
      continue
    }

    // page.publication
    const page = sim.get(op.path)
    if (!page) {
      problems.push({ index, message: `Page ${op.path} not found` })
      continue
    }
    const master = page.docs.get(config.defaultLocale)!
    checkRevs(index, [{ id: master.id, path: page.path, locale: config.defaultLocale }])
    preview.push({
      index,
      op: op.op,
      path: op.path,
      locales: presentLocales(page.docs, config),
      changes: page.publicationState === op.state
        ? []
        : [{ field: 'publicationState', before: page.publicationState, after: op.state }],
    })
    page.publicationState = op.state
  }

  return {
    result: { ok: problems.length === 0, problems, preview },
    state,
    operations: normalized,
  }
}

/** `POST /__couchfusion/control/pages/check` — validates without writing. */
export const checkPageOperations = async (request: PageOperationsRequest): Promise<PageOperationsCheckResult> =>
  (await runCheck(request)).result

// ---------------------------------------------------------------------------
// Apply
// ---------------------------------------------------------------------------

export interface AppliedOperation {
  index: number
  path: string
  documents: Array<{ id: string; rev: string; deleted?: true }>
}

export type PageOperationsApplyResult =
  | { status: 200; body: { ok: true; applied: AppliedOperation[] } }
  | { status: 409; body: { ok: false; problems: PageOperationProblem[] } }
  | { status: 500; body: { ok: false; applied: AppliedOperation[]; failed: { index: number; message: string } } }

interface ReadDocs {
  live: Map<string, Doc>
  deleted: Map<string, string>
}

const readDocs = async (ids: string[]): Promise<ReadDocs> => {
  const response = await getAllDocs(getContentDatabaseName(), { keys: ids, include_docs: true })
  if (!response) {
    throw createError({ statusCode: 503, statusMessage: 'Content database unavailable' })
  }
  const live = new Map<string, Doc>()
  const deleted = new Map<string, string>()
  for (const row of Array.isArray(response.rows) ? response.rows : []) {
    if (row?.doc && typeof row.doc._id === 'string') {
      live.set(row.doc._id, row.doc as Doc)
    } else if (row?.value?.deleted && typeof row.id === 'string' && typeof row.value.rev === 'string') {
      deleted.set(row.id, row.value.rev)
    }
  }
  return { live, deleted }
}

const involvedPaths = (op: NormalizedOperation): string[] =>
  op.op === 'page.move' || op.op === 'page.copyContent' ? [op.from, op.to] : [op.path]

const writtenPath = (op: NormalizedOperation): string =>
  op.op === 'page.move' || op.op === 'page.copyContent' ? op.to : op.path

const errorMessage = (error: unknown): string => {
  const candidate = error as { statusMessage?: unknown; message?: unknown }
  if (typeof candidate?.statusMessage === 'string' && candidate.statusMessage) {
    return candidate.statusMessage
  }
  if (typeof candidate?.message === 'string' && candidate.message) {
    return candidate.message
  }
  return String(error)
}

const seoPayload = (seo: SeoPatch): Doc => {
  const payload: Doc = {}
  if (seo.title !== undefined) payload.title = seo.title
  if (seo.description !== undefined) payload.description = seo.description
  // `sanitiseIncomingDocument` merges with `??`, so an empty string clears the image.
  if ('image' in seo) payload.image = seo.image ?? ''
  return payload
}

const writeOperation = async (op: NormalizedOperation, current: Map<string, LoadedPage>, config: ContentI18nConfig) => {
  if (op.op === 'page.create') {
    // Same path as `POST /api/content/pages` (builder create): default-locale
    // document, `isCreate: true` (409 if it exists), page history saved.
    const document: Doc = {
      path: op.path,
      title: op.title,
      body: { type: 'minimal', value: clonePlain(op.body) },
      publicationState: op.publicationState,
    }
    if (op.seo) document.seo = seoPayload(op.seo)
    if (op.layout) document.layout = clonePlain(op.layout)
    await saveLocalizedPageDocument({ document, locale: config.defaultLocale }, { isCreate: true })
    return
  }

  if (op.op === 'page.update') {
    const document: Doc = { path: op.path }
    if (op.title !== undefined) document.title = op.title
    if (op.seo) document.seo = seoPayload(op.seo)
    if (op.body) document.body = { type: 'minimal', value: clonePlain(op.body) }
    if (op.layout) document.layout = clonePlain(op.layout)
    await saveLocalizedPageDocument({ document, locale: op.locale }, { isCreate: false })
    return
  }

  if (op.op === 'page.move') {
    await renameContentPageUrl({ sourcePath: op.from, targetPath: op.to, keepRedirect: op.keepRedirect })
    return
  }

  if (op.op === 'page.publication') {
    await setContentPagePublicationState({ path: op.path, publicationState: op.state })
    return
  }

  const source = current.get(op.from)
  const target = current.get(op.to)
  if (!source || !target) {
    throw createError({ statusCode: 404, statusMessage: `Page ${source ? op.to : op.from} not found` })
  }
  const sourceFixed = readContentDocumentLocalizationMeta(masterOf(source, config), config).fixedBodyPaths
  // Default locale first: saving the master propagates fixed body paths to translations.
  for (const locale of presentLocales(target.docs, config)) {
    const sourceLocale = source.docs.has(locale) ? locale : config.defaultLocale
    const sourceDoc = source.docs.get(sourceLocale)!
    const document: Doc = {
      path: op.to,
      body: { type: 'minimal', value: clonePlain(readLocaleBody(source, sourceLocale, config)) },
      layout: isPlainObject(sourceDoc.layout) ? clonePlain(sourceDoc.layout) : { spacing: 'none' },
    }
    if (sourceFixed.length) {
      // Fixed body paths are pointers into the body; they must follow the copied body.
      const targetMeta = isPlainObject(target.docs.get(locale)!.meta) ? clonePlain(target.docs.get(locale)!.meta) : {}
      const i18n = isPlainObject(targetMeta.contentI18n) ? targetMeta.contentI18n : {}
      document.meta = { ...targetMeta, contentI18n: { ...i18n, fixedBodyPaths: sourceFixed } }
    }
    await saveLocalizedPageDocument({ document, locale }, { isCreate: false })
  }
}

/**
 * `POST /__couchfusion/control/pages/apply` — re-runs `check` (409 with problems,
 * nothing written), then applies the operations in order. Before each operation the
 * involved documents are re-read and must still have the revs seen by `check` (or
 * written by an earlier operation); afterwards the written documents are reported.
 */
export const applyPageOperations = async (request: PageOperationsRequest): Promise<PageOperationsApplyResult> => {
  const { result, state, operations } = await runCheck(request)
  if (!result.ok) {
    return { status: 409, body: { ok: false, problems: result.problems } }
  }

  const { config } = state
  const expected = new Map<string, string>(state.revs)
  const applied: AppliedOperation[] = []

  for (let index = 0; index < operations.length; index += 1) {
    const op = operations[index]
    try {
      const ids = Array.from(new Set(involvedPaths(op).flatMap((path) => pageDocumentIds(path, config))))
      const before = await readDocs(ids)
      for (const id of ids) {
        const rev = before.live.get(id)?._rev ?? null
        if (rev !== (expected.get(id) ?? null)) {
          throw createError({ statusCode: 409, statusMessage: `Document ${id} changed while applying; stopped` })
        }
      }

      await writeOperation(op, groupPageDocuments(Array.from(before.live.values()), config), config)

      const after = await readDocs(ids)
      const documents: AppliedOperation['documents'] = []
      for (const id of ids) {
        const previous = before.live.get(id)?._rev ?? null
        const live = after.live.get(id)
        if (live && live._rev !== previous) {
          documents.push({ id, rev: live._rev })
          expected.set(id, live._rev)
        } else if (!live && previous !== null) {
          const tombstone = after.deleted.get(id)
          documents.push({ id, rev: tombstone ?? '', deleted: true })
          expected.delete(id)
        }
      }
      applied.push({ index, path: writtenPath(op), documents })
    } catch (error) {
      return { status: 500, body: { ok: false, applied, failed: { index, message: errorMessage(error) } } }
    }
  }

  return { status: 200, body: { ok: true, applied } }
}
