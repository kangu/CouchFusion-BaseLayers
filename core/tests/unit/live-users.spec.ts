import { describe, expect, it } from 'vitest'
import {
  LiveUsersHub,
  sanitizeUserChange,
} from '../../src/features/live-users/server/hub'
import type { OperationClient } from '../../src/server/operations'
describe('live users', () => {
  it('strips password material and rejects mismatched identities', () => {
    expect(
      sanitizeUserChange({
        id: 'org.couchdb.user:alice',
        doc: {
          name: 'alice',
          type: 'user',
          roles: ['member', 7],
          password: 'secret',
          derived_key: 'secret',
        },
      }),
    ).toEqual({ name: 'alice', roles: ['member'] })
    expect(
      sanitizeUserChange({
        id: 'org.couchdb.user:alice',
        doc: { name: 'bob', type: 'user', roles: [] },
      }),
    ).toBeNull()
  })
  it('dispatches changes only to their owner and cleans subscriptions', () => {
    const hub = new LiveUsersHub()
    const alice: unknown[] = []
    const bob: unknown[] = []
    const unsubscribe = hub.subscribe('alice', (user) => alice.push(user))
    hub.subscribe('bob', (user) => bob.push(user))
    hub.publish({ id: 'org.couchdb.user:alice', deleted: true })
    expect(alice).toEqual([{ name: 'alice', roles: [] }])
    expect(bob).toEqual([])
    unsubscribe()
    hub.publish({ id: 'org.couchdb.user:alice', deleted: true })
    expect(alice).toHaveLength(1)
  })
  it('starts one follower and aborts it on worker cleanup', async () => {
    let count = 0
    let aborted = false
    const client: OperationClient = {
      request: async (_path, options) => {
        count++
        return new Promise<Response>((_resolve, reject) =>
          options!.signal!.addEventListener(
            'abort',
            () => {
              aborted = true
              reject(new Error('aborted'))
            },
            { once: true },
          ),
        )
      },
      json: async () => {
        throw new Error('unused')
      },
    }
    const hub = new LiveUsersHub()
    hub.start(client)
    hub.start(client)
    expect(count).toBe(1)
    await hub.stop()
    expect(aborted).toBe(true)
  })
})
