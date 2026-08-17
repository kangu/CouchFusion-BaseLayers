import { createError } from 'h3'
import { getAllDocs, putDocument } from '#database/utils/couchdb'
import { clonePlain, contentIdFromPath, deriveStem } from '#content/utils/page-documents'
import { normalizePagePath } from '#content/utils/page'
import { canResolveContentRouteAccessForPath, normalizeContentRoutePath } from '#content/utils/route-access'
import { buildLocaleDocumentIds, getLocaleDocumentId, parseLocaleFromDocumentId } from '#content/server/utils/content-i18n'
import { getEffectiveContentI18nConfig } from '#content/server/utils/content-i18n-settings'
import { getContentDatabaseName } from '#content/server/utils/database'
import { createContentPageRedirectMeta, parseContentPageRedirect } from '#content/utils/page-redirect'

export interface ContentPageUrlRenameInput {
  sourcePath: string
  targetPath: string
  keepRedirect: boolean
}

const asRecord = (value: unknown): Record<string, any> | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : null

export const renameContentPageUrl = async (input: ContentPageUrlRenameInput) => {
  const sourcePath = normalizeContentRoutePath(input?.sourcePath)
  const targetPath = normalizeContentRoutePath(input?.targetPath)
  if (!sourcePath || !targetPath || sourcePath === targetPath || !canResolveContentRouteAccessForPath(targetPath)) {
    throw createError({ statusCode: 400, statusMessage: 'Source and target must be distinct internal content paths' })
  }

  const { effective: config } = await getEffectiveContentI18nConfig()
  const databaseName = getContentDatabaseName()
  const sourceIds = buildLocaleDocumentIds(sourcePath, config)
  const targetIds = buildLocaleDocumentIds(targetPath, config)
  const response = await getAllDocs(databaseName, { keys: [...sourceIds, ...targetIds], include_docs: true })
  const documentsById = new Map((response?.rows ?? []).flatMap((row: any) => row.doc ? [[row.doc._id, row.doc]] : []))
  const sourceDocuments = sourceIds.map(id => asRecord(documentsById.get(id))).filter((doc): doc is Record<string, any> => Boolean(doc))
  if (!sourceDocuments.some(doc => doc._id === getLocaleDocumentId(sourcePath, config.defaultLocale, config))) {
    throw createError({ statusCode: 404, statusMessage: 'Source page not found' })
  }
  if (targetIds.some(id => documentsById.has(id))) {
    throw createError({ statusCode: 409, statusMessage: 'Target page already exists' })
  }
  if (sourceDocuments.some(doc => parseContentPageRedirect(doc.meta, sourcePath).status !== 'none')) {
    throw createError({ statusCode: 409, statusMessage: 'Redirect pages cannot be renamed' })
  }

  const now = new Date().toISOString()
  const targetBySourceId = new Map<string, Record<string, any>>()
  for (const source of sourceDocuments) {
    const locale = parseLocaleFromDocumentId(source._id, config.defaultLocale)
    const targetId = getLocaleDocumentId(targetPath, locale, config)
    const target = clonePlain(source)
    target._id = targetId
    delete target._rev
    target.path = normalizePagePath(targetPath)
    target.stem = deriveStem(targetPath)
    target.createdAt = now
    target.updatedAt = now
    const i18n = target.meta?.contentI18n
    if (i18n && typeof i18n === 'object') {
      target.meta = { ...target.meta, contentI18n: { ...i18n, masterId: contentIdFromPath(targetPath), basePath: targetPath } }
    }
    targetBySourceId.set(source._id, target)
  }

  const completed = { created: [] as string[], retired: [] as string[] }
  try {
    for (const target of targetBySourceId.values()) {
      await putDocument(databaseName, target)
      completed.created.push(target._id)
    }
    for (const source of sourceDocuments) {
      const target = targetBySourceId.get(source._id)!
      const retired = input.keepRedirect
        ? { _id: source._id, _rev: source._rev, type: 'page', path: source.path, stem: source.stem, title: null, layout: { spacing: 'none' }, body: { type: 'minimal', value: [] }, seo: { title: null, description: null }, navigation: false, publicationState: 'published', meta: createContentPageRedirectMeta(target.path), createdAt: source.createdAt ?? now, updatedAt: now }
        : { _id: source._id, _rev: source._rev, _deleted: true }
      await putDocument(databaseName, retired)
      completed.retired.push(source._id)
    }
  } catch (error) {
    throw createError({ statusCode: 500, statusMessage: 'Page URL rename stopped before completion', data: { completed, cause: error instanceof Error ? error.message : String(error) } })
  }

  const sourceMasterId = getLocaleDocumentId(sourcePath, config.defaultLocale, config)
  return {
    page: targetBySourceId.get(sourceMasterId)!,
    sourcePath,
    targetPath,
    migratedLocales: sourceDocuments.map(doc => parseLocaleFromDocumentId(doc._id, config.defaultLocale)),
    redirectRetained: input.keepRedirect,
    completed,
  }
}
