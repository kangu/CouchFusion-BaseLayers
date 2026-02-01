import { defineEventHandler, createError } from 'h3'
import { requireAdminSession } from '../../../utils/auth'
import { proxySSE } from '../../../utils/codex-sessions'

export default defineEventHandler(async (event) => {
    await requireAdminSession(event)
    const id = event.context.params?.id
    if (!id) {
        throw createError({ statusCode: 400, statusMessage: 'id is required' })
    }
    await proxySSE(event, `/sessions/${id}/stream`)
})
