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
    setBodyValue,
    toPageDocumentRecord,
} from '../../utils/content-i18n'
import { normalizePublicationState, normalizeSeoImage } from '#content/utils/page-documents'
import { getEffectiveContentI18nConfig } from '../../utils/content-i18n-settings'
import { resolveContentEditorSession } from '../../utils/auth'

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
        availableLocales?: string[]
        missingLocales?: string[]
    },
) => {
    const normalizedPath = normalizePagePath(path)
    const seoTitle = document.seoTitle ?? document.seo?.title ?? null
    const seoDescription = document.seoDescription ?? document.seo?.description ?? null
    const meta = document.meta ?? document.metadata ?? {}
    const publicationState = normalizePublicationState(document.publicationState)
    const responseDocument = {
        ...document,
        publicationState,
    }

    return {
        id: document._id || pageIdFromPath(normalizedPath),
        path: normalizedPath,
        title: document.title ?? null,
        seoTitle,
        seoDescription,
        publicationState,
        meta,
        updatedAt:
            localization.updatedAtByLocale[localization.locale] ??
            document.updatedAt ??
            document.updated_at ??
            null,
        doc: responseDocument,
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

/** Keeps route access owned by the master document for every localized response. */
const inheritMasterRouteAccess = (
    responseDocument: Record<string, any>,
    masterDocument: Record<string, any>,
): void => {
    const responseMeta = responseDocument.meta && typeof responseDocument.meta === 'object'
        ? { ...responseDocument.meta }
        : {}
    const masterMeta = masterDocument.meta && typeof masterDocument.meta === 'object'
        ? masterDocument.meta
        : {}

    if (Object.prototype.hasOwnProperty.call(masterMeta, 'routeAccess')) {
        responseMeta.routeAccess = structuredClone(masterMeta.routeAccess)
    } else {
        delete responseMeta.routeAccess
    }

    responseDocument.meta = responseMeta
}

const buildRootLegacyDocumentIds = (
    normalizedPath: string,
    locale: string,
    defaultLocale: string,
): { legacyMasterId: string | null; legacyLocaleId: string | null } => {
    if (normalizedPath !== '/') {
        return {
            legacyMasterId: null,
            legacyLocaleId: null,
        }
    }

    const legacyMasterId = 'page-/'
    return {
        legacyMasterId,
        legacyLocaleId: locale === defaultLocale ? legacyMasterId : `${legacyMasterId}::${locale}`,
    }
}

export default defineEventHandler(async (event) => {
    try {
        setResponseHeader(event, 'Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
        setResponseHeader(event, 'Pragma', 'no-cache')
        setResponseHeader(event, 'Expires', '0')

        const query = getQuery(event)
        const requestedPath = typeof query.path === 'string' ? query.path : null
        const { effective: contentI18nConfig } = await getEffectiveContentI18nConfig()
        const databaseName = getContentDatabaseName()
        const contentEditorSession = await resolveContentEditorSession(event)
        const canReadDrafts = Boolean(contentEditorSession)

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
            const { legacyMasterId, legacyLocaleId } = buildRootLegacyDocumentIds(
                normalizedPath,
                locale,
                contentI18nConfig.defaultLocale,
            )
            if (legacyMasterId && !documentIds.includes(legacyMasterId)) {
                documentIds.push(legacyMasterId)
            }
            if (legacyLocaleId && !documentIds.includes(legacyLocaleId)) {
                documentIds.push(legacyLocaleId)
            }

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

            const masterDocument = docsById.get(masterId) ?? (
                legacyMasterId ? docsById.get(legacyMasterId) : undefined
            )

            if (!masterDocument) {
                throw createError({
                    statusCode: 404,
                    statusMessage: 'Page not found',
                })
            }

            if (normalizePublicationState(masterDocument.publicationState) === 'draft' && !canReadDrafts) {
                throw createError({
                    statusCode: 404,
                    statusMessage: 'Page not found',
                })
            }

            const localeDocument =
                locale === contentI18nConfig.defaultLocale
                    ? masterDocument
                    : docsById.get(localeId) ??
                      (legacyLocaleId ? docsById.get(legacyLocaleId) : null) ??
                      null

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
            responseDocument.publicationState = normalizePublicationState(masterDocument.publicationState)
            inheritMasterRouteAccess(responseDocument, masterDocument)

            if (hasLocaleDocument && localeDocument) {
                const mergedBodyValue = buildLocalizedBodyForRead(
                    getBodyValue(masterDocument),
                    getBodyValue(localeDocument),
                    masterMeta.fixedBodyPaths,
                )
                setBodyValue(responseDocument, mergedBodyValue)

                // Keep locale SEO image optional in locale docs while guaranteeing a share image fallback.
                const localizedSeo = responseDocument.seo && typeof responseDocument.seo === 'object'
                    ? responseDocument.seo
                    : {}
                const localizedImage = normalizeSeoImage(localizedSeo.image)
                if (!localizedImage) {
                    const masterImage = normalizeSeoImage(masterDocument.seo?.image)
                    if (masterImage) {
                        responseDocument.seo = {
                            ...localizedSeo,
                            image: masterImage,
                        }
                    }
                }
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
        const pagesByBasePath = new Map<
            string,
            {
                masterId: string
                masterDocument: Record<string, any> | null
                docsByLocale: Map<string, Record<string, any>>
                updatedAtByLocale: Record<string, string>
            }
        >()

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

            const basePath = normalizePagePath(localizationMeta.basePath ?? normalizedPath)
            const locale = localizationMeta.locale
            const updatedAt =
                localizationMeta.updatedAtByLocale[locale] ??
                document.updatedAt ??
                document.updated_at ??
                ''

            if (!pagesByBasePath.has(basePath)) {
                pagesByBasePath.set(basePath, {
                    masterId: localizationMeta.masterId,
                    masterDocument: null,
                    docsByLocale: new Map<string, Record<string, any>>(),
                    updatedAtByLocale: {},
                })
            }

            const group = pagesByBasePath.get(basePath)!
            group.masterId = localizationMeta.masterId

            const existingLocaleDoc = group.docsByLocale.get(locale)
            const existingLocaleUpdatedAt =
                existingLocaleDoc?.updatedAt ?? existingLocaleDoc?.updated_at ?? ''
            if (!existingLocaleDoc || updatedAt >= existingLocaleUpdatedAt) {
                group.docsByLocale.set(locale, document)
            }

            group.updatedAtByLocale = mergeUpdatedAtByLocale(
                group.updatedAtByLocale,
                localizationMeta.updatedAtByLocale,
            )
            if (updatedAt) {
                group.updatedAtByLocale[locale] = updatedAt
            }

            const isMasterDocument =
                locale === contentI18nConfig.defaultLocale ||
                document._id === group.masterId

            if (isMasterDocument) {
                const existingMasterUpdatedAt =
                    group.masterDocument?.updatedAt ??
                    group.masterDocument?.updated_at ??
                    ''
                if (!group.masterDocument || updatedAt >= existingMasterUpdatedAt) {
                    group.masterDocument = document
                }
            }
        }

        const pages = Array.from(pagesByBasePath.entries())
            .map(([basePath, group]) => {
                const defaultLocale = contentI18nConfig.defaultLocale
                const masterDocument =
                    group.masterDocument ??
                    group.docsByLocale.get(defaultLocale) ??
                    null

                if (!masterDocument) {
                    return null
                }

                if (
                    normalizePublicationState(masterDocument.publicationState) === 'draft' &&
                    !canReadDrafts
                ) {
                    return null
                }

                const availableLocales = contentI18nConfig.locales.filter((locale) =>
                    group.docsByLocale.has(locale),
                )
                const missingLocales = contentI18nConfig.locales.filter(
                    (locale) => !availableLocales.includes(locale),
                )

                return toResponseEntry(masterDocument, basePath, {
                    locale: defaultLocale,
                    defaultLocale,
                    masterId: group.masterId,
                    hasLocaleDocument: false,
                    updatedAtByLocale: group.updatedAtByLocale,
                    missingLocalizedCount: missingLocales.length,
                    availableLocales,
                    missingLocales,
                })
            })
            .filter((entry): entry is ReturnType<typeof toResponseEntry> => Boolean(entry))
            .sort((left, right) => left.path.localeCompare(right.path))

        return {
            success: true,
            pages,
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
