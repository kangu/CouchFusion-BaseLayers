import { defineEventHandler, readBody, createError } from 'h3'
import { requireAdminSession } from '../../utils/auth'
import { codexFetch, getCodexConfig } from '../../utils/codex-sessions'

interface CreateBody {
    root?: string
    prompt?: string
    ttl_sec?: number
}

export default defineEventHandler(async (event) => {
    await requireAdminSession(event)
    const body = (await readBody(event)) as CreateBody

    const { allowedRoots } = getCodexConfig(event)
    if (!body?.root || typeof body.root !== 'string') {
        throw createError({ statusCode: 400, statusMessage: 'root is required' })
    }
    if (allowedRoots.length > 0 && !allowedRoots.includes(body.root)) {
        throw createError({ statusCode: 400, statusMessage: 'root not allowed' })
    }
    if (!body.prompt || typeof body.prompt !== 'string') {
        throw createError({ statusCode: 400, statusMessage: 'prompt is required' })
    }

    const payload: CreateBody = {
        root: body.root,
        prompt: body.prompt,
    }
    if (typeof body.ttl_sec === 'number' && body.ttl_sec > 0) {
        payload.ttl_sec = body.ttl_sec
    }

    const result = await codexFetch<any>(event, '/sessions', {
        method: 'POST',
        body: JSON.stringify(payload),
    })

    return result
})
