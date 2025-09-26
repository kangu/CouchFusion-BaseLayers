/**
 * Server-Sent Events (SSE) Route for Real-time User Document Changes
 * 
 * Provides authenticated SSE connections for receiving real-time
 * user document changes from CouchDB's _users database.
 * 
 * Authentication: Uses existing AuthSession cookies (sent automatically with SSE)
 * Security: Users only receive updates for their own user documents
 */

import { defineEventHandler, createError, getCookie, setHeaders } from 'h3'
import { validateCouchSession } from '../utils/couchSession'
import { usersHub } from '../utils/usersHub'

const HEARTBEAT_INTERVAL_MS = 30_000

export default defineEventHandler(async (event) => {
  try {
    console.log('[SSE] New connection attempt')
    
    // Extract AuthSession cookie (automatically sent with SSE requests)
    const authSessionCookie = getCookie(event, 'AuthSession')
    console.log('[SSE] AuthSession cookie:', authSessionCookie ? 'present' : 'absent')
    
    // Validate the user session using AuthSession cookie
    const user = await validateCouchSession(authSessionCookie)
    
    if (!user) {
      console.warn('[SSE] Unauthorized connection attempt')
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized: Invalid or missing AuthSession cookie'
      })
    }

    console.log(`[SSE] Authentication successful for user: ${user.name}`)

    // Set SSE headers
    setHeaders(event, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
      'X-Accel-Buffering': 'no' // Disable nginx buffering
    })

    // Store user info on the event for later use
    event.context.user = user
    event.context.heartbeatInterval = null

    // Register with the users hub for SSE
    usersHub.registerSSE(user.name, event)
    
    // Send initial connection message
    try {
      const welcomeMessage = {
        type: 'connected',
        user: {
          name: user.name,
          roles: user.roles
        },
        timestamp: new Date().toISOString(),
        message: 'Connected to user changes stream'
      }
      
      event.node.res.write(`data: ${JSON.stringify(welcomeMessage)}\n\n`)
      console.log(`[SSE] Welcome message sent to user: ${user.name}`)
    } catch (error) {
      console.warn('[SSE] Failed to send welcome message:', error)
    }

    // Set up heartbeat to keep connection alive
    const heartbeatInterval = setInterval(() => {
      try {
        const heartbeat = {
          type: 'ping',
          timestamp: new Date().toISOString()
        }
        event.node.res.write(`data: ${JSON.stringify(heartbeat)}\n\n`)
      } catch (error) {
        console.warn('[SSE] Failed to send heartbeat:', error)
        clearInterval(heartbeatInterval)
      }
    }, HEARTBEAT_INTERVAL_MS)

    event.context.heartbeatInterval = heartbeatInterval

    // Handle client disconnect
    event.node.req.on('close', () => {
      console.log(`[SSE] User ${user.name} disconnected`)
      
      // Clean up heartbeat
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval)
      }
      
      // Unregister from users hub
      usersHub.unregisterSSE(event)
    })

    // Handle client abort
    event.node.req.on('aborted', () => {
      console.log(`[SSE] Connection aborted for user ${user.name}`)
      
      // Clean up heartbeat
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval)
      }
      
      // Unregister from users hub
      usersHub.unregisterSSE(event)
    })

    console.log(`[SSE] SSE connection established for user: ${user.name}`)
    
    // Keep the connection alive by not returning
    // The connection will stay open until client disconnects
    
  } catch (error) {
    console.error('[SSE] Error setting up SSE connection:', error)
    
    // Re-throw if it's already a createError
    if (error.statusCode) {
      throw error
    }
    
    // Otherwise, return generic error
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error while setting up SSE connection'
    })
  }
})