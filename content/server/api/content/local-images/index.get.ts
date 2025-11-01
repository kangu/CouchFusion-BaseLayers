import { defineEventHandler, getQuery } from 'h3'
import { requireAuthRoleSession } from '../../../utils/auth'
import { listLocalImages } from '../../../utils/local-images'

const clampNumber = (value: unknown, defaultValue: number, options: { min?: number; max?: number } = {}) => {
    const parsed = Number.parseInt(String(value ?? ''), 10)
    if (!Number.isFinite(parsed)) {
        return defaultValue
    }
    const { min, max } = options
    let next = parsed
    if (typeof min === 'number') {
        next = Math.max(min, next)
    }
    if (typeof max === 'number') {
        next = Math.min(max, next)
    }
    return next
}

export default defineEventHandler(async (event) => {
    await requireAuthRoleSession(event)

    const query = getQuery(event)
    const search = typeof query.search === 'string' && query.search.trim() ? query.search.trim() : undefined
    const limit = clampNumber(query.limit, 50, { min: 1, max: 500 })
    const page = clampNumber(query.page, 1, { min: 1 })
    const offset = (page - 1) * limit

    const images = await listLocalImages(search)
    const paginated = images.slice(offset, offset + limit)

    return {
        success: true,
        images: paginated,
        total: images.length,
        page,
        pageSize: limit
    }
})
