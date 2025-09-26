import { defineEventHandler, createError, setHeader, getCookie } from "h3"
import { logout } from '#database/utils/couchdb'

export default defineEventHandler(async (event) => {
  try {
    // Extract AuthSession cookie from request
    const authSessionCookie = getCookie(event, 'AuthSession')
    
    if (!authSessionCookie) {
      // Even if no session cookie exists, we return success for idempotent behavior
      return { ok: true, message: 'No active session found' }
    }

    // Call CouchDB logout function
    const logoutResult = await logout({ 
      authSessionCookie: authSessionCookie 
    })

    if (logoutResult?.ok) {
      // If CouchDB returned a Set-Cookie header to clear the cookie, use it
      if (logoutResult.setCookie) {
        setHeader(event, 'Set-Cookie', logoutResult.setCookie)
      } else {
        // Fallback: manually clear the AuthSession cookie
        setHeader(event, 'Set-Cookie', 
          'AuthSession=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0'
        )
      }

      return { ok: true, message: 'Successfully logged out' }
    } else {
      // Even if CouchDB logout fails, clear the cookie locally for better UX
      setHeader(event, 'Set-Cookie', 
        'AuthSession=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0'
      )
      
      return { ok: true, message: 'Session cleared locally' }
    }
  } catch (error) {
    console.error('Logout error:', error)
    
    // Clear cookie even on error for security
    setHeader(event, 'Set-Cookie', 
      'AuthSession=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0'
    )
    
    // Return success to avoid exposing internal errors
    return { ok: true, message: 'Session cleared' }
  }
})