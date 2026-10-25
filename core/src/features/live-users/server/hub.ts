import type { OperationClient } from '../../../server/operations'
export interface LiveUser {
  name: string
  roles: string[]
}
export interface UserChange {
  id?: string
  deleted?: boolean
  doc?: Record<string, unknown>
}
/** Only the public identity fields cross the stream boundary. */
export function sanitizeUserChange(change: UserChange): LiveUser | null {
  if (!change.id?.startsWith('org.couchdb.user:')) return null
  const name = change.id.slice('org.couchdb.user:'.length)
  if (!name) return null
  if (change.deleted) return { name, roles: [] }
  if (change.doc?.name !== name || change.doc?.type !== 'user') return null
  return {
    name,
    roles: Array.isArray(change.doc.roles)
      ? change.doc.roles.filter(
          (role): role is string => typeof role === 'string',
        )
      : [],
  }
}
export class LiveUsersHub {
  private listeners = new Map<string, Set<(user: LiveUser) => void>>()
  private controller?: AbortController
  private task?: Promise<void>
  subscribe(name: string, listener: (user: LiveUser) => void): () => void {
    const set = this.listeners.get(name) || new Set()
    set.add(listener)
    this.listeners.set(name, set)
    return () => {
      set.delete(listener)
      if (!set.size) this.listeners.delete(name)
    }
  }
  publish(change: UserChange): void {
    const user = sanitizeUserChange(change)
    if (user)
      for (const listener of this.listeners.get(user.name) || []) listener(user)
  }
  start(client: OperationClient): void {
    if (this.task) return
    const controller = new AbortController()
    this.controller = controller
    this.task = this.follow(client, controller.signal).finally(() => {
      this.task = undefined
    })
  }
  async stop(): Promise<void> {
    this.controller?.abort()
    await this.task
    this.listeners.clear()
  }
  private async follow(
    client: OperationClient,
    signal: AbortSignal,
  ): Promise<void> {
    let since: unknown = 'now'
    while (!signal.aborted) {
      try {
        const params = new URLSearchParams({
          feed: 'longpoll',
          include_docs: 'true',
          timeout: '25000',
          since: typeof since === 'string' ? since : JSON.stringify(since),
        })
        const response = await client.request(`/_users/_changes?${params}`, {
          signal,
        })
        if (!response.ok)
          throw new Error(`Changes feed failed (${response.status})`)
        const page = (await response.json()) as {
          results?: UserChange[]
          last_seq?: unknown
        }
        if (!Array.isArray(page.results) || page.last_seq === undefined)
          throw new Error('Invalid changes feed response')
        for (const change of page.results) this.publish(change)
        since = page.last_seq
      } catch {
        if (signal.aborted) return
        await new Promise<void>((resolve) => {
          const onAbort = () => {
            clearTimeout(timer)
            resolve()
          }
          const timer = setTimeout(() => {
            signal.removeEventListener('abort', onAbort)
            resolve()
          }, 2000)
          signal.addEventListener('abort', onAbort, { once: true })
          if (signal.aborted) onAbort()
        })
      }
    }
  }
}
/** Module scope creates exactly one follower per worker. */
export const liveUsersHub = new LiveUsersHub()
