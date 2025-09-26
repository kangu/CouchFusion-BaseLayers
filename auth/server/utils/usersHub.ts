/**
 * Users Hub - Manages SSE connections mapped by username
 * Provides a centralized way to broadcast user document changes to connected clients
 */

type SSEEvent = any // h3's event object for SSE

/**
 * Manages SSE connections grouped by username
 * Allows broadcasting messages to all connections for a specific user
 */
class UsersHub {
  private map = new Map<string, Set<SSEEvent>>()

  /**
   * Register an SSE connection for a username
   */
  registerSSE(username: string, event: SSEEvent): void {
    if (!this.map.has(username)) {
      this.map.set(username, new Set())
    }
    
    this.map.get(username)!.add(event)
    
    // Store username on event context for cleanup
    event.context.hubUser = username
    
    console.log(`[UsersHub] User ${username} connected via SSE (${this.map.get(username)!.size} connections)`)
  }

  /**
   * Unregister an SSE connection
   */
  unregisterSSE(event: SSEEvent): void {
    const username = event.context.hubUser
    if (!username) return
    
    const userConnections = this.map.get(username)
    if (!userConnections) return
    
    userConnections.delete(event)
    
    if (userConnections.size === 0) {
      this.map.delete(username)
      console.log(`[UsersHub] User ${username} fully disconnected from SSE`)
    } else {
      console.log(`[UsersHub] User ${username} SSE connection closed (${userConnections.size} remaining)`)
    }
    
    delete event.context.hubUser
  }

  /**
   * Broadcast a message to all SSE connections for a specific username
   */
  broadcastToUser(username: string, payload: unknown): void {
    const userConnections = this.map.get(username)
    if (!userConnections) return
    
    const message = `data: ${JSON.stringify(payload)}\n\n`
    let successCount = 0
    let errorCount = 0
    
    for (const event of userConnections) {
      try {
        event.node.res.write(message)
        successCount++
      } catch (error) {
        errorCount++
        console.warn(`[UsersHub] Failed to send SSE message to ${username}:`, error)
      }
    }
    
    if (successCount > 0) {
      console.log(`[UsersHub] SSE broadcasted to ${username}: ${successCount} success, ${errorCount} errors`)
    }
  }

  /**
   * Get list of currently online usernames
   */
  onlineUsernames(): string[] {
    return Array.from(this.map.keys())
  }

  /**
   * Get statistics about connected users
   */
  getStats(): { totalUsers: number, totalConnections: number } {
    let totalConnections = 0
    for (const connections of this.map.values()) {
      totalConnections += connections.size
    }
    
    return {
      totalUsers: this.map.size,
      totalConnections
    }
  }
}

// Create global singleton instance
const globalThis = global as any
export const usersHub: UsersHub = globalThis.__usersHub || (globalThis.__usersHub = new UsersHub())