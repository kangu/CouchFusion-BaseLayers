export interface CodexSessionCreateResponse {
    session_id: string
    stream_url: string
    expires_at: string
}

export interface CodexSessionStatus {
    id: string
    state: 'created' | 'running' | 'done' | 'error' | 'expired' | 'killed'
    created_at: string
    expires_at: string
    last_event: string
}

export interface CodexDiscoveryCaps {
    maxSeconds?: number
    maxBytes?: number
    maxCommands?: number
}

export interface CodexConfigInfo {
    allowedRoots: string[]
    discoveryCaps: CodexDiscoveryCaps
}

export interface StreamEvent {
    type: 'data' | 'state'
    data: string
}
