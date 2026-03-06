import { normalizePagePath } from '#content/utils/page'
import { clonePlain, contentIdFromPath, ensureMinimalBody } from '#content/utils/page-documents'
import {
  CONTENT_META_I18N_KEY,
  getDocumentI18nMeta,
  getValueAtPath,
  normalizeLocaleCode,
  resolveContentLocalePath,
  resolveContentI18nConfig,
  setValueAtPath,
  isLocalizedValueMissing,
} from '#content/utils/i18n'
import type { ContentI18nConfig } from '#content/utils/i18n'
import type { ContentPageDocument } from '#content/types/content-page'
import { useRuntimeConfig } from '#imports'

const I18N_META_VERSION = 1

type PathSegment = string | number

const isPlainObject = (value: unknown): value is Record<string, any> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const decodePointerToken = (token: string): string =>
  token.replace(/~1/g, '/').replace(/~0/g, '~')

export const parseBodyPathPointer = (path: string): PathSegment[] => {
  if (typeof path !== 'string' || !path.startsWith('/')) {
    return []
  }

  const segments = path
    .split('/')
    .slice(1)
    .map((token) => decodePointerToken(token))

  return segments.map((segment) => {
    if (/^\d+$/.test(segment)) {
      return Number.parseInt(segment, 10)
    }
    return segment
  })
}

const escapePointerToken = (token: PathSegment): string =>
  String(token).replace(/~/g, '~0').replace(/\//g, '~1')

export const toBodyPathPointer = (segments: PathSegment[]): string =>
  `/${segments.map((segment) => escapePointerToken(segment)).join('/')}`

export const getLocaleDocumentId = (
  path: string,
  locale: string,
  config: Pick<ContentI18nConfig, 'defaultLocale'>,
): string => {
  const normalizedPath = normalizePagePath(path)
  const masterId = contentIdFromPath(normalizedPath)
  const normalizedLocale = normalizeLocaleCode(locale) ?? config.defaultLocale

  if (normalizedLocale === config.defaultLocale) {
    return masterId
  }

  return `${masterId}::${normalizedLocale}`
}

export const parseLocaleFromDocumentId = (
  documentId: string,
  defaultLocale: string,
): string => {
  if (typeof documentId !== 'string') {
    return defaultLocale
  }

  const markerIndex = documentId.lastIndexOf('::')
  if (markerIndex === -1) {
    return defaultLocale
  }

  const suffix = documentId.slice(markerIndex + 2)
  return normalizeLocaleCode(suffix) ?? defaultLocale
}

export const resolveRuntimeContentI18nConfig = (): ContentI18nConfig => {
  const runtimeConfig = useRuntimeConfig()
  return resolveContentI18nConfig(
    runtimeConfig.content?.i18n ?? runtimeConfig.public?.content?.i18n,
  )
}

export const resolveRequestedLocale = (
  localeInput: unknown,
  config: ContentI18nConfig,
): string => {
  const locale = normalizeLocaleCode(localeInput)

  if (!locale || !config.locales.includes(locale)) {
    return config.defaultLocale
  }

  return locale
}

export const buildLocaleDocumentIds = (
  path: string,
  config: ContentI18nConfig,
): string[] => {
  const normalizedPath = normalizePagePath(path)
  return config.locales.map((locale) =>
    getLocaleDocumentId(normalizedPath, locale, config),
  )
}

export interface ContentDocumentLocalizationMeta {
  locale: string
  masterId: string
  basePath: string
  defaultLocale: string
  updatedAtByLocale: Record<string, string>
  fixedBodyPaths: string[]
}

const normalizeFixedBodyPaths = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return []
  }

  return Array.from(
    new Set(
      value
        .filter((entry): entry is string => typeof entry === 'string' && entry.startsWith('/')),
    ),
  ).sort()
}

export const readContentDocumentLocalizationMeta = (
  document: Record<string, any> | null | undefined,
  config: ContentI18nConfig,
): ContentDocumentLocalizationMeta => {
  const doc = isPlainObject(document) ? document : {}
  const normalizedPath = normalizePagePath(doc.path ?? '/')
  const derivedBasePath = resolveContentLocalePath(normalizedPath, config).basePath

  const rawMeta = isPlainObject(doc.meta) ? doc.meta : {}
  const rawI18n = isPlainObject(rawMeta[CONTENT_META_I18N_KEY])
    ? rawMeta[CONTENT_META_I18N_KEY]
    : {}
  const basePath =
    typeof rawI18n.basePath === 'string' && rawI18n.basePath.trim()
      ? normalizePagePath(rawI18n.basePath)
      : derivedBasePath
  const defaultMasterId = contentIdFromPath(basePath)

  const localeFromMeta = normalizeLocaleCode(rawI18n.locale)
  const localeFromId = parseLocaleFromDocumentId(String(doc._id ?? ''), config.defaultLocale)
  const locale =
    localeFromMeta && config.locales.includes(localeFromMeta)
      ? localeFromMeta
      : localeFromId

  const masterId =
    typeof rawI18n.masterId === 'string' && rawI18n.masterId.trim()
      ? rawI18n.masterId
      : defaultMasterId

  const fixedBodyPaths = normalizeFixedBodyPaths(rawI18n.fixedBodyPaths)

  const updatedAtByLocale = getDocumentI18nMeta(rawMeta).updatedAtByLocale

  return {
    locale,
    masterId,
    basePath,
    defaultLocale: config.defaultLocale,
    updatedAtByLocale,
    fixedBodyPaths,
  }
}

export const ensureDocumentLocalizationMeta = (
  document: Record<string, any>,
  options: {
    locale: string
    masterId: string
    basePath: string
    defaultLocale: string
    touchedAt: string
    fixedBodyPaths?: string[]
    mergedUpdatedAtByLocale?: Record<string, string>
  },
): void => {
  if (!isPlainObject(document.meta)) {
    document.meta = {}
  }

  const currentMeta = readContentDocumentLocalizationMeta(document, {
    enabled: true,
    defaultLocale: options.defaultLocale,
    locales: [options.defaultLocale, options.locale],
    prefixedLocales:
      options.locale === options.defaultLocale ? [] : [options.locale],
  })

  const updatedAtByLocale = {
    ...currentMeta.updatedAtByLocale,
    ...(options.mergedUpdatedAtByLocale ?? {}),
    [options.locale]: options.touchedAt,
  }

  const currentI18n = isPlainObject(document.meta[CONTENT_META_I18N_KEY])
    ? document.meta[CONTENT_META_I18N_KEY]
    : {}

  const fixedBodyPaths =
    options.fixedBodyPaths ??
    normalizeFixedBodyPaths(currentI18n.fixedBodyPaths)

  document.meta[CONTENT_META_I18N_KEY] = {
    ...currentI18n,
    version: I18N_META_VERSION,
    masterId: options.masterId,
    locale: options.locale,
    basePath: normalizePagePath(options.basePath),
    defaultLocale: options.defaultLocale,
    fixedBodyPaths,
    updatedAtByLocale,
  }
}

const toBodyValue = (document: Record<string, any> | null | undefined): unknown[] => {
  if (!isPlainObject(document)) {
    return []
  }

  return ensureMinimalBody(document.body).value
}

const deepValueEqual = (left: unknown, right: unknown): boolean => {
  try {
    return JSON.stringify(left) === JSON.stringify(right)
  } catch {
    return left === right
  }
}

export const valuesDeepEqual = (left: unknown, right: unknown): boolean =>
  deepValueEqual(left, right)

const parseJsonString = (value: string): unknown | null => {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

type ResolvedBodyPointerTarget =
  | {
      mode: 'direct'
      value: unknown
      path: PathSegment[]
    }
  | {
      mode: 'encoded'
      value: unknown
      encodedPath: PathSegment[]
      nestedPath: PathSegment[]
      parsedRoot: unknown
    }

const resolveBodyPointerTarget = (
  bodyValue: unknown,
  path: PathSegment[],
): ResolvedBodyPointerTarget | null => {
  const directValue = getValueAtPath(bodyValue, path)
  if (typeof directValue !== 'undefined') {
    return {
      mode: 'direct',
      value: directValue,
      path,
    }
  }

  for (let index = 0; index < path.length; index += 1) {
    const segment = path[index]
    if (typeof segment !== 'string' || segment.startsWith(':')) {
      continue
    }

    const encodedPath = [...path.slice(0, index), `:${segment}`]
    const encodedRaw = getValueAtPath(bodyValue, encodedPath)
    if (typeof encodedRaw !== 'string') {
      continue
    }

    const parsedRoot = parseJsonString(encodedRaw)
    if (parsedRoot === null) {
      continue
    }

    const nestedPath = path.slice(index + 1)
    const encodedValue =
      nestedPath.length > 0 ? getValueAtPath(parsedRoot, nestedPath) : parsedRoot

    if (typeof encodedValue === 'undefined') {
      continue
    }

    return {
      mode: 'encoded',
      value: encodedValue,
      encodedPath,
      nestedPath,
      parsedRoot,
    }
  }

  return null
}

const getBodyPointerValue = (bodyValue: unknown, path: PathSegment[]): unknown =>
  resolveBodyPointerTarget(bodyValue, path)?.value

const setBodyPointerValue = (
  bodyValue: unknown,
  path: PathSegment[],
  value: unknown,
): unknown => {
  const target = resolveBodyPointerTarget(bodyValue, path)
  if (!target) {
    return bodyValue
  }

  if (target.mode === 'direct') {
    return setValueAtPath(bodyValue, target.path, clonePlain(value))
  }

  const nextParsedRoot =
    target.nestedPath.length > 0
      ? setValueAtPath(target.parsedRoot, target.nestedPath, clonePlain(value))
      : clonePlain(value)

  return setValueAtPath(
    bodyValue,
    target.encodedPath,
    JSON.stringify(nextParsedRoot),
  )
}

export const collectChangedFixedBodyPaths = (
  previousBodyValue: unknown,
  nextBodyValue: unknown,
  fixedBodyPaths: string[],
): string[] => {
  const changed: string[] = []

  for (const pointer of fixedBodyPaths) {
    const path = parseBodyPathPointer(pointer)
    if (!path.length) {
      continue
    }

    const previousValue = getBodyPointerValue(previousBodyValue, path)
    const nextValue = getBodyPointerValue(nextBodyValue, path)

    if (!deepValueEqual(previousValue, nextValue)) {
      changed.push(pointer)
    }
  }

  return changed
}

export const applyFixedBodyPaths = (
  masterBodyValue: unknown,
  targetBodyValue: unknown,
  fixedBodyPaths: string[],
): unknown => {
  let nextBodyValue = clonePlain(targetBodyValue)

  for (const pointer of fixedBodyPaths) {
    const path = parseBodyPathPointer(pointer)
    if (!path.length) {
      continue
    }

    const masterValueAtPath = getBodyPointerValue(masterBodyValue, path)
    if (typeof masterValueAtPath === 'undefined') {
      continue
    }
    nextBodyValue = setBodyPointerValue(nextBodyValue, path, masterValueAtPath)
  }

  return nextBodyValue
}

export const applyBodyPathsFromSource = (
  targetBodyValue: unknown,
  sourceBodyValue: unknown,
  pointers: string[],
): unknown => {
  let nextBodyValue = clonePlain(targetBodyValue)

  for (const pointer of pointers) {
    const path = parseBodyPathPointer(pointer)
    if (!path.length) {
      continue
    }

    const sourceValueAtPath = getBodyPointerValue(sourceBodyValue, path)
    if (typeof sourceValueAtPath === 'undefined') {
      continue
    }
    nextBodyValue = setBodyPointerValue(nextBodyValue, path, sourceValueAtPath)
  }

  return nextBodyValue
}

const mergeLocalizedBodyNode = (masterNode: unknown, localeNode: unknown): unknown => {
  if (localeNode === undefined || localeNode === null) {
    return clonePlain(masterNode)
  }

  if (typeof localeNode === 'string') {
    if (!localeNode.trim() && typeof masterNode === 'string') {
      return clonePlain(masterNode)
    }
    return clonePlain(localeNode)
  }

  if (Array.isArray(localeNode)) {
    const masterArray = Array.isArray(masterNode) ? masterNode : []
    const maxLength = Math.max(masterArray.length, localeNode.length)

    const merged: unknown[] = []
    for (let index = 0; index < maxLength; index += 1) {
      merged[index] = mergeLocalizedBodyNode(masterArray[index], localeNode[index])
    }

    return merged
  }

  if (isPlainObject(localeNode)) {
    const masterObject = isPlainObject(masterNode) ? masterNode : {}
    const merged: Record<string, unknown> = {}
    const keys = new Set([
      ...Object.keys(masterObject),
      ...Object.keys(localeNode),
    ])

    for (const key of keys) {
      merged[key] = mergeLocalizedBodyNode(masterObject[key], localeNode[key])
    }

    return merged
  }

  return clonePlain(localeNode)
}

export const buildLocalizedBodyForRead = (
  masterBodyValue: unknown,
  localeBodyValue: unknown,
  fixedBodyPaths: string[],
): unknown => {
  const merged = mergeLocalizedBodyNode(masterBodyValue, localeBodyValue)
  return applyFixedBodyPaths(masterBodyValue, merged, fixedBodyPaths)
}

const countMissingLocalizedLeafValues = (
  masterNode: unknown,
  localeBodyValue: unknown,
  fixedPathSet: Set<string>,
  path: PathSegment[],
): number => {
  const pointer = toBodyPathPointer(path)

  if (fixedPathSet.has(pointer)) {
    return 0
  }

  if (Array.isArray(masterNode)) {
    return masterNode.reduce((count, child, index) => {
      return (
        count +
        countMissingLocalizedLeafValues(
          child,
          localeBodyValue,
          fixedPathSet,
          [...path, index],
        )
      )
    }, 0)
  }

  if (isPlainObject(masterNode)) {
    return Object.entries(masterNode).reduce((count, [key, child]) => {
      return (
        count +
        countMissingLocalizedLeafValues(
          child,
          localeBodyValue,
          fixedPathSet,
          [...path, key],
        )
      )
    }, 0)
  }

  const localeValue = getValueAtPath(localeBodyValue, path)
  return isLocalizedValueMissing(localeValue) ? 1 : 0
}

export const countMissingLocalizedValues = (
  masterBodyValue: unknown,
  localeBodyValue: unknown,
  fixedBodyPaths: string[],
): number => {
  if (!Array.isArray(masterBodyValue)) {
    return 0
  }

  const fixedPathSet = new Set(fixedBodyPaths)

  return masterBodyValue.reduce((count, entry, index) => {
    return (
      count +
      countMissingLocalizedLeafValues(
        entry,
        localeBodyValue,
        fixedPathSet,
        [index],
      )
    )
  }, 0)
}

export const toPageDocumentRecord = (
  value: unknown,
): Record<string, any> | null => {
  if (!isPlainObject(value)) {
    return null
  }

  const doc = value as Record<string, any>
  if (doc.type && doc.type !== 'page') {
    return null
  }

  return doc
}

export const clonePageDocument = (document: Record<string, any>): Record<string, any> => {
  const cloned = clonePlain(document)
  if (!isPlainObject(cloned.meta)) {
    cloned.meta = {}
  }
  cloned.body = ensureMinimalBody(cloned.body)
  cloned.path = normalizePagePath(cloned.path ?? '/')
  return cloned
}

export const getBodyValue = (document: Record<string, any>): unknown[] =>
  toBodyValue(document)

export const setBodyValue = (document: Record<string, any>, value: unknown): void => {
  document.body = ensureMinimalBody({
    type: 'minimal',
    value: Array.isArray(value) ? value : [],
  })
}

export const mergeUpdatedAtByLocale = (
  ...entries: Array<Record<string, string> | null | undefined>
): Record<string, string> => {
  const merged: Record<string, string> = {}

  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') {
      continue
    }

    for (const [locale, timestamp] of Object.entries(entry)) {
      const normalizedLocale = normalizeLocaleCode(locale)
      if (!normalizedLocale || typeof timestamp !== 'string' || !timestamp.trim()) {
        continue
      }
      merged[normalizedLocale] = timestamp
    }
  }

  return merged
}

export const normalizePageDocumentPath = (document: ContentPageDocument): string =>
  normalizePagePath(document.path)
