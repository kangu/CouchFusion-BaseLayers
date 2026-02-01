import { ref } from 'vue'
import type { StreamEvent } from '#content/types/codex-sessions'

export function useCodexStream() {
    const events = ref<StreamEvent[]>([])
    const connected = ref(false)
    const bytes = ref(0)
    const state = ref<string>('idle')
    const commandCount = ref(0)

    let es: EventSource | null = null

    function pushEvent(evt: StreamEvent) {
        events.value.push(evt)
        if (events.value.length > 500) {
            events.value.splice(0, events.value.length - 500)
        }
    }

    function connect(sessionId: string) {
        disconnect()
        bytes.value = 0
        state.value = 'connecting'
        const source = new EventSource(`/api/codex-sessions/${sessionId}/stream`)
        es = source

        source.onopen = () => {
            connected.value = true
            state.value = 'running'
        }

        source.addEventListener('state', (e: MessageEvent) => handlePayload('state', e.data))
        source.addEventListener('data', (e: MessageEvent) => handlePayload('data', e.data))
        // Fallback for default event channel if backend ever emits without 'event' field
        source.onmessage = (e: MessageEvent) => handlePayload('data', e.data)

        source.onerror = () => {
            connected.value = false
            // EventSource will auto-retry; keep state informative
        }
    }

    function disconnect() {
        if (es) {
            es.close()
            es = null
        }
        connected.value = false
    }

    function handlePayload(eventType: 'data' | 'state', raw: string) {
        try {
            const parsed = JSON.parse(raw)
            if (eventType === 'state') {
                const nextState = parsed.state ?? raw
                state.value = nextState
                commandCount.value = parsed.commandCount ?? commandCount.value
                bytes.value = parsed.bytes ?? bytes.value
                pushEvent({ type: 'state', data: JSON.stringify(parsed) })
                if (['done', 'error', 'expired', 'killed'].includes(nextState)) {
                    disconnect()
                }
                return
            }
            const dataStr = parsed.data ?? raw
            if (typeof dataStr === 'string') {
                bytes.value = parsed.bytes ?? bytes.value + dataStr.length
                commandCount.value = parsed.commandCount ?? commandCount.value
                pushEvent({ type: 'data', data: dataStr })
            }
        } catch (_err) {
            const dataStr = typeof raw === 'string' ? raw.replace(/\\n/g, '\n') : ''
            if (eventType === 'state') {
                state.value = dataStr
            } else {
                bytes.value += dataStr.length
            }
            pushEvent({ type: eventType, data: dataStr })
        }
    }

    return {
        events,
        connected,
        bytes,
        commandCount,
        state,
        connect,
        disconnect,
    }
}
