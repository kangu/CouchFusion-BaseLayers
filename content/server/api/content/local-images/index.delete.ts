import { createError, defineEventHandler, getQuery } from 'h3'
import { promises as fs } from 'node:fs'
import { requireAuthRoleSession } from '../../../utils/auth'
import { resolveImagePath } from '../../../utils/local-images'

export default defineEventHandler(async (event) => {
    await requireAuthRoleSession(event)
    const query = getQuery(event)
    const filePath = typeof query.path === 'string' ? query.path : typeof query.filePath === 'string' ? query.filePath : null

    if (!filePath) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Missing image path'
        })
    }

    const target = resolveImagePath(filePath)

    try {
        await fs.unlink(target)
    } catch (error: any) {
        if (error?.code === 'ENOENT') {
            throw createError({
                statusCode: 404,
                statusMessage: 'Image not found'
            })
        }
        throw createError({
            statusCode: 500,
            statusMessage: 'Failed to delete image'
        })
    }

    return {
        success: true
    }
})
