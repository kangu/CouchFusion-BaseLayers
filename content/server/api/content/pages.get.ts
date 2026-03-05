import { defineEventHandler, getQuery, createError, setResponseHeader } from 'h3'
import { getAllDocs, getView } from '#database/utils/couchdb'
import { getContentDatabaseName } from '../../utils/database'
import { normalizePagePath, pageIdFromPath } from '#content/utils/page'
import { buildLocalizedPath, resolveContentLocalePath } from '#content/utils/i18n'
import {
    buildLocaleDocumentIds,
    buildLocalizedBodyForRead,
    clonePageDocument,
    countMissingLocalizedValues,
    getBodyValue,
    getLocaleDocumentId,
    mergeUpdatedAtByLocale,
    readContentDocumentLocalizationMeta,
    resolveRequestedLocale,
    resolveRuntimeContentI18nConfig,
    setBodyValue,
    toPageDocumentRecord,
} from '../../utils/content-i18n'

const toResponseEntry = (
    document: Record<string, any>,
    path: string,
    localization: {
        locale: string
        defaultLocale: string
        masterId: string
        hasLocaleDocument: boolean
        updatedAtByLocale: Record<string, string>
        missingLocalizedCount: number
    },
) => {
    const normalizedPath = normalizePagePath(path)
    const seoTitle = document.seoTitle ?? document.seo?.title ?? null
    const seoDescription = document.seoDescription ?? document.seo?.description ?? null
    const meta = document.meta ?? document.metadata ?? {}

    return {
        id: document._id || pageIdFromPath(normalizedPath),
        path: normalizedPath,
        title: document.title ?? null,
        seoTitle,
        seoDescription,
        meta,
        updatedAt:
            localization.updatedAtByLocale[localization.locale] ??
            document.updatedAt ??
            document.updated_at ??
            null,
        doc: document,
        localization,
    }
}

const mapRowsById = (rows: Array<{ id?: string; doc?: Record<string, any> }>): Map<string, Record<string, any>> => {
    const result = new Map<string, Record<string, any>>()

    for (const row of rows) {
        const doc = toPageDocumentRecord(row.doc)
        if (!doc || typeof doc._id !== 'string') {
            continue
        }

        result.set(doc._id, doc)
    }

    return result
}

export default defineEventHandler(async (event) => {
    try {
        setResponseHeader(event, 'Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
        setResponseHeader(event, 'Pragma', 'no-cache')
        setResponseHeader(event, 'Expires', '0')

        const query = getQuery(event)
        const requestedPath = typeof query.path === 'string' ? query.path : null
        const contentI18nConfig = resolveRuntimeContentI18nConfig()
        const databaseName = getContentDatabaseName()

        if (requestedPath) {
            const normalizedRequestedPath = normalizePagePath(requestedPath)
            const resolvedPath = resolveContentLocalePath(
                normalizedRequestedPath,
                contentI18nConfig,
            )
            const normalizedPath = resolvedPath.basePath
            const locale = resolveRequestedLocale(
                query.locale ?? resolvedPath.locale,
                contentI18nConfig,
            )
            const documentIds = buildLocaleDocumentIds(normalizedPath, contentI18nConfig)

            const allDocsResponse = await getAllDocs(databaseName, {
                keys: documentIds,
                include_docs: true,
            })

            const rows = Array.isArray(allDocsResponse?.rows) ? allDocsResponse.rows : []
            const docsById = mapRowsById(rows as Array<{ id?: string; doc?: Record<string, any> }>)

            const masterId = getLocaleDocumentId(
                normalizedPath,
                contentI18nConfig.defaultLocale,
                contentI18nConfig,
            )
            const localeId = getLocaleDocumentId(normalizedPath, locale, contentI18nConfig)

            const masterDocument = docsById.get(masterId)

            if (!masterDocument) {
                throw createError({
                    statusCode: 404,
                    statusMessage: 'Page not found',
                })
            }

            const localeDocument =
                locale === contentI18nConfig.defaultLocale
                    ? masterDocument
                    : docsById.get(localeId) ?? null

            const masterMeta = readContentDocumentLocalizationMeta(masterDocument, contentI18nConfig)
            const localeMeta = localeDocument
                ? readContentDocumentLocalizationMeta(localeDocument, contentI18nConfig)
                : null

            const mergedUpdatedAtByLocale = mergeUpdatedAtByLocale(
                masterMeta.updatedAtByLocale,
                localeMeta?.updatedAtByLocale,
            )

            const hasLocaleDocument = Boolean(
                locale !== contentI18nConfig.defaultLocale && localeDocument,
            )

            const responseDocument = clonePageDocument(localeDocument ?? masterDocument)
            const responsePath = buildLocalizedPath(
                normalizedPath,
                locale,
                contentI18nConfig,
            )
            responseDocument.path = responsePath

            if (hasLocaleDocument && localeDocument) {
                const mergedBodyValue = buildLocalizedBodyForRead(
                    getBodyValue(masterDocument),
                    getBodyValue(localeDocument),
                    masterMeta.fixedBodyPaths,
                )
                setBodyValue(responseDocument, mergedBodyValue)
            }

            const missingLocalizedCount =
                locale === contentI18nConfig.defaultLocale
                    ? 0
                    : countMissingLocalizedValues(
                          getBodyValue(masterDocument),
                          localeDocument ? getBodyValue(localeDocument) : undefined,
                          masterMeta.fixedBodyPaths,
                      )

            return {
                success: true,
                page: toResponseEntry(responseDocument, responsePath, {
                    locale,
                    defaultLocale: contentI18nConfig.defaultLocale,
                    masterId: masterMeta.masterId,
                    hasLocaleDocument,
                    updatedAtByLocale: mergedUpdatedAtByLocale,
                    missingLocalizedCount,
                }),
            }
        }

        const viewResult = await getView(databaseName, 'content', 'by_path', {
            include_docs: true,
        })

        const rows = Array.isArray(viewResult?.rows) ? viewResult.rows : []
        const pageByPath = new Map<string, ReturnType<typeof toResponseEntry>>()

        for (const row of rows) {
            const document = toPageDocumentRecord(row.doc)
            if (!document) {
                continue
            }

            const pathFromRow =
                typeof row.key === 'string'
                    ? row.key
                    : typeof document.path === 'string'
                      ? document.path
                      : '/'
            const normalizedPath = normalizePagePath(pathFromRow)
            const localizationMeta = readContentDocumentLocalizationMeta(
                document,
                contentI18nConfig,
            )

            if (localizationMeta.locale !== contentI18nConfig.defaultLocale) {
                continue
            }

            if (
                typeof document._id === 'string' &&
                document._id !== localizationMeta.masterId
            ) {
                continue
            }

            const entry = toResponseEntry(document, normalizedPath, {
                locale: contentI18nConfig.defaultLocale,
                defaultLocale: contentI18nConfig.defaultLocale,
                masterId: localizationMeta.masterId,
                hasLocaleDocument: false,
                updatedAtByLocale: localizationMeta.updatedAtByLocale,
                missingLocalizedCount: 0,
            })

            const existing = pageByPath.get(normalizedPath)
            if (!existing) {
                pageByPath.set(normalizedPath, entry)
                continue
            }

            const existingUpdatedAt = existing.updatedAt ?? ''
            const nextUpdatedAt = entry.updatedAt ?? ''
            if (nextUpdatedAt > existingUpdatedAt) {
                pageByPath.set(normalizedPath, entry)
            }
        }

        return {
            success: true,
            pages: Array.from(pageByPath.values()).sort((left, right) =>
                left.path.localeCompare(right.path),
            ),
        }
    } catch (error: any) {
        if (error?.statusCode) {
            throw error
        }

        console.error('Content pages GET error:', error)

        throw createError({
            statusCode: 500,
            statusMessage: 'Failed to fetch pages',
        })
    }
})
