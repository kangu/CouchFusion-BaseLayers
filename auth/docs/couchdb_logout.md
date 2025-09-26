# CouchDB Logout Implementation

## Overview

This document describes the implementation of user logout functionality using CouchDB's `_session` endpoint. The logout system provides both server-side session termination and client-side state clearing for a complete authentication cleanup.

## Components

### 1. CouchDB Logout Function (`layers/database/utils/couchdb.ts`)

The `logout()` function implements CouchDB's DELETE `/_session` endpoint:

```typescript
export async function logout(
  authOptions: { authSessionCookie: string } | { basicAuthToken: string },
  config?: CouchDBConfig
): Promise<{ ok: boolean; setCookie?: string } | null>
```

**Features:**
- Accepts either AuthSession cookie or Basic Auth token
- Smart cookie value extraction (handles both `AuthSession=value` and `value` formats)
- Returns logout response with optional Set-Cookie header for cookie clearing
- Graceful error handling with console warnings

**Usage Example:**
```typescript
// Using AuthSession cookie
const result = await logout({ authSessionCookie: 'abc123' });

// Using basic auth token  
const result = await logout({ basicAuthToken: 'dXNlcjpwYXNz' });

if (result?.ok) {
  console.log('User logged out successfully');
}
```

### 2. Server API Endpoint (`layers/auth/server/api/logout.delete.ts`)

DELETE endpoint at `/api/logout` that:
- Extracts AuthSession cookie from the request
- Calls the CouchDB logout function
- Sets appropriate headers to clear the cookie
- Returns consistent success responses for security

**Key Features:**
- Idempotent behavior (returns success even if no session exists)
- Multiple cookie clearing strategies (CouchDB response or fallback)
- Always clears cookie locally even if server logout fails
- Error-safe (never exposes internal errors to client)

### 3. Auth Store Integration (`layers/auth/app/stores/auth.ts`)

Updated `logout()` method to:
- Call the server logout endpoint via DELETE `/api/logout`
- Clear local authentication state
- Handle server errors gracefully
- Always succeed locally for better UX

**Usage in Components:**
```typescript
const authStore = useAuthStore()

// Logout user
const success = await authStore.logout()
```

## Authentication Flow

### Login Flow (for context)
1. User provides credentials
2. Server authenticates with CouchDB
3. AuthSession cookie is set
4. Client stores user/session state

### Logout Flow
1. Client calls `authStore.logout()`
2. Store calls `DELETE /api/logout`
3. Server extracts AuthSession cookie
4. Server calls CouchDB's `DELETE /_session`
5. Server clears cookie via Set-Cookie header
6. Client clears local state
7. User is fully logged out

## Security Considerations

- **Idempotent Design**: Logout always returns success to prevent information leakage
- **Cookie Clearing**: Multiple strategies ensure cookie is cleared even if CouchDB fails
- **Local State**: Always cleared regardless of server response
- **Error Handling**: Never expose internal errors to prevent information disclosure

## Error Handling

The logout system is designed to always succeed from the user's perspective:

1. **No Session Cookie**: Returns success with "No active session" message
2. **CouchDB Failure**: Clears cookie locally, returns success
3. **Network Errors**: Clears local state, logs warning, returns success locally

## Integration Notes

- Compatible with existing CouchDB authentication system
- Maintains consistency with login/session management patterns
- Uses the same cookie handling as authentication flow
- Follows Nuxt.js server API conventions

## Testing

To test logout functionality:

1. **Login first** to establish session
2. **Call logout endpoint**:
   ```bash
   curl -X DELETE http://localhost:3000/api/logout \
     -H "Cookie: AuthSession=your_session_cookie"
   ```
3. **Verify cookie clearing** in response headers
4. **Test idempotent behavior** by calling logout again