import { defineEventHandler } from 'h3'
import { codexFetch } from '../../utils/codex-sessions'
import { requireAdminSession } from '../../utils/auth'

export default defineEventHandler(async (event) => {
    await requireAdminSession(event)
    return await codexFetch(event, '/health')
})
