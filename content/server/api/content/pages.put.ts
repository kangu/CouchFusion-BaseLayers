import { defineEventHandler, readBody, createError } from 'h3'
import { requireAdminSession } from '../../utils/auth'
import { saveLocalizedPageDocument } from '../../utils/content-pages-save'

export default defineEventHandler(async (event) => {
    await requireAdminSession(event)

    try {
        const body = await readBody<{ document: any; locale?: string }>(event)

        if (!body || typeof body.document !== 'object' || body.document === null) {
            throw createError({
                statusCode: 400,
                statusMessage: 'Invalid payload: document is required',
            })
        }

        const result = await saveLocalizedPageDocument(body, { isCreate: false })

        return {
            success: true,
            id: result.page._id,
            rev: result.page._rev,
            page: {
                ...result.page,
                localization: {
                    locale: result.locale,
                    defaultLocale: result.defaultLocale,
                    updatedAtByLocale: result.updatedAtByLocale,
                    hasLocaleDocument: result.hasLocaleDocument,
                    missingLocalizedCount: result.missingLocalizedCount,
                },
            },
        }
    } catch (error: any) {
        if (error?.statusCode) {
            throw error
        }

        console.error('Content pages PUT error:', error)

        throw createError({
            statusCode: 500,
            statusMessage: 'Failed to update page',
        })
    }
})
