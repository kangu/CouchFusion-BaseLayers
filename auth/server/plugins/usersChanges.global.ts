/**
 * Global CouchDB _users Database Changes Follower
 * 
 * This plugin creates a single global connection to CouchDB's _users database
 * _changes feed and broadcasts user document changes to connected SSE clients.
 * 
 * Features:
 * - Single global _changes follower for all users
 * - Auto-reconnect with exponential backoff
 * - Fan-out to SSE connections by username
 * - Security: users only receive updates for their own documents
 */

import { sanitizeUserDoc } from '../utils/sanitizeUserDoc'
import { usersHub } from '../utils/usersHub'

export default defineNitroPlugin(() => {
  // Skip during build/prerendering to prevent hanging
  if (process.env.prerender || process.env.NITRO_PRESET) {
    console.log('[UsersChanges] Skipping during build/prerendering phase')
    return
  }

  // Prevent multiple instances
  const g = globalThis as any
  if (g.__usersChangesStarted) return
  g.__usersChangesStarted = true

  const config = useRuntimeConfig()
  let backoffMs = 1000

  const startChangesFollower = async () => {
    const { couchUrl, couchAdminAuth } = config
    
    if (!couchUrl || !couchAdminAuth) {
      console.error('[UsersChanges] Missing CouchDB configuration')
      return
    }

    // Build _changes feed URL
    const changesUrl = `${couchUrl}/_users/_changes?feed=continuous&since=now&include_docs=true&heartbeat=30000`
    
    try {
      console.log('[UsersChanges] Starting _users changes follower...')
      
      const response = await fetch(changesUrl, {
        headers: {
          'Accept': 'application/json',
          'Authorization': `Basic ${couchAdminAuth}`
        }
      })

      if (!response.ok || !response.body) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`)
      }

      // Reset backoff on successful connection
      backoffMs = 1000
      console.log('[UsersChanges] Connected to _users changes feed')

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      // Process the continuous stream
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        
        let newlineIndex
        while ((newlineIndex = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, newlineIndex).trim()
          buffer = buffer.slice(newlineIndex + 1)
          
          if (!line) continue // Skip empty lines (heartbeats)
          
          try {
            const changeRow = JSON.parse(line)
            await handleUserChange(changeRow)
          } catch (parseError) {
            // Ignore JSON parse errors (heartbeats, partial data, etc.)
          }
        }
      }

      console.log('[UsersChanges] Stream ended, reconnecting...')
    } catch (error) {
      console.error('[UsersChanges] Connection error:', error)
    }

    // Reconnect with exponential backoff
    setTimeout(startChangesFollower, backoffMs)
    backoffMs = Math.min(backoffMs * 2, 30000)
  }

  /**
   * Handle a user document change from the _changes feed
   */
  async function handleUserChange(changeRow: any) {
    const { id, seq, doc } = changeRow
    
    // Only process user documents
    if (!id || !id.startsWith('org.couchdb.user:')) {
      return
    }

    // Extract username from document ID
    const username = id.slice('org.couchdb.user:'.length)
    if (!username) return

    // Only process if document exists (not deleted)
    if (!doc) return

    // Sanitize the document for client consumption
    const sanitizedDoc = sanitizeUserDoc(doc)
    if (!sanitizedDoc) return

    // Broadcast to all SSE connections for this user
    const payload = {
      type: 'user-change',
      id,
      seq,
      doc: sanitizedDoc,
      timestamp: new Date().toISOString()
    }

    try {
      usersHub.broadcastToUser(username, payload)
    } catch (error) {
      console.error(`[UsersChanges] Failed to broadcast to ${username}:`, error)
    }
  }

  // Start the changes follower
  startChangesFollower()

  console.log('[UsersChanges] Plugin initialized')
})