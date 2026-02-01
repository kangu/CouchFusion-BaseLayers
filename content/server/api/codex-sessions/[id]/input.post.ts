import { defineEventHandler, readBody, createError } from 'h3'
import { requireAdminSession } from '../../../utils/auth'
import { codexFetch } from '../../../utils/codex-sessions'

export default defineEventHandler(async (event) => {
    await requireAdminSession(event)
    const id = event.context.params?.id
    if (!id) {
        throw createError({ statusCode: 400, statusMessage: 'id is required' })
    }
    const body = await readBody(event)
    const text = typeof body?.text === 'string' ? body.text : null
    if (!text) {
        throw createError({ statusCode: 400, statusMessage: 'text is required' })
    }

    return await codexFetch(event, `/sessions/${id}/input`, {
        method: 'POST',
        body: JSON.stringify({ text }),
    })
})
