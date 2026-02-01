import { createError } from 'h3'
import type { H3Event } from 'h3'

interface DiscoveryCaps {
    maxSeconds?: number
    maxBytes?: number
    maxCommands?: number
}

interface CodexConfig {
    serverUrl: string
    token: string
    allowedRoots: string[]
    discoveryCaps: DiscoveryCaps
}

export function getCodexConfig(event: H3Event): CodexConfig {
    const runtimeConfig = useRuntimeConfig(event)
    const serverUrl: string = runtimeConfig.codexSessions?.serverUrl || ''
    const token: string = runtimeConfig.codexSessions?.token || ''
    const allowedRoots: string[] = runtimeConfig.codexSessions?.allowedRoots || []
    const discoveryCaps: DiscoveryCaps = runtimeConfig.codexSessions?.discoveryCaps || {}

    if (!serverUrl || !token) {
        throw createError({
            statusCode: 500,
            statusMessage: 'Codex session server not configured',
        })
    }

    return {
        serverUrl: serverUrl.replace(/\/$/, ''),
        token,
        allowedRoots,
        discoveryCaps,
    }
}

export async function codexFetch<T>(event: H3Event, path: string, init: RequestInit = {}): Promise<T> {
    const { serverUrl, token } = getCodexConfig(event)
    const url = `${serverUrl}${path}`

    const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
        ...(init.headers as Record<string, string> | undefined),
    }

    if (init.body && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/json'
    }

    const res = await fetch(url, {
        ...init,
        headers,
    })

    if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw createError({
            statusCode: res.status,
            statusMessage: text || 'Codex session server error',
        })
    }

    const contentType = res.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
        return (await res.json()) as T
    }

    // fallback plain text
    return (await res.text()) as T
}

/**
 * Stream an SSE response from the Codex server to the client.
 */
export async function proxySSE(event: H3Event, path: string) {
    const { serverUrl, token } = getCodexConfig(event)
    const url = `${serverUrl}${path}`

    const res = await fetch(url, {
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'text/event-stream',
        },
    })

    if (!res.ok || !res.body) {
        const text = await res.text().catch(() => '')
        throw createError({
            statusCode: res.status || 500,
            statusMessage: text || 'Failed to proxy SSE',
        })
    }

    const reader = res.body.getReader()
    const writable = event.node.res

    event.node.res.setHeader('Content-Type', 'text/event-stream')
    event.node.res.setHeader('Cache-Control', 'no-cache')
    event.node.res.setHeader('Connection', 'keep-alive')

    const cancel = () => {
        try {
            reader.cancel()
        } catch (_) {
            /* ignore */
        }
    }
    event.node.req.on('close', cancel)

    while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if (value) {
            writable.write(Buffer.from(value))
        }
        if (event.node.req.aborted) {
            cancel()
            break
        }
    }

    writable.end()
}
