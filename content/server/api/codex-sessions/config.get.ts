import { defineEventHandler } from 'h3'
import { getCodexConfig } from '../../utils/codex-sessions'
import { requireAdminSession } from '../../utils/auth'

export default defineEventHandler(async (event) => {
    await requireAdminSession(event)
    const cfg = getCodexConfig(event)
    return {
        allowedRoots: cfg.allowedRoots,
        discoveryCaps: cfg.discoveryCaps,
    }
})
