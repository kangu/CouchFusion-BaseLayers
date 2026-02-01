import { ref } from 'vue'
import type {
    CodexSessionCreateResponse,
    CodexSessionStatus,
    CodexConfigInfo,
} from '#content/types/codex-sessions'

interface CreatePayload {
    root: string
    prompt: string
    ttl_sec?: number
}

export function useCodexSessions() {
    const creating = ref(false)
    const error = ref<string | null>(null)

    async function createSession(payload: CreatePayload): Promise<CodexSessionCreateResponse> {
        creating.value = true
        error.value = null
        try {
            const result = await $fetch<CodexSessionCreateResponse>('/api/codex-sessions', {
                method: 'POST',
                body: payload,
            })
            return result
        } catch (err: any) {
            error.value = err?.statusMessage || err?.message || 'Failed to create session'
            throw err
        } finally {
            creating.value = false
        }
    }

    async function sendInput(id: string, text: string) {
        return await $fetch(`/api/codex-sessions/${id}/input`, {
            method: 'POST',
            body: { text },
        })
    }

    async function stopSession(id: string) {
        return await $fetch(`/api/codex-sessions/${id}/stop`, {
            method: 'POST',
        })
    }

    async function deleteSession(id: string) {
        return await $fetch(`/api/codex-sessions/${id}`, {
            method: 'DELETE',
        })
    }

    async function getStatus(id: string): Promise<CodexSessionStatus> {
        return await $fetch<CodexSessionStatus>(`/api/codex-sessions/${id}/status`)
    }

    async function getConfig(): Promise<CodexConfigInfo> {
        return await $fetch<CodexConfigInfo>('/api/codex-sessions/config')
    }

    return {
        creating,
        error,
        createSession,
        sendInput,
        stopSession,
        deleteSession,
        getStatus,
        getConfig,
    }
}
