# Auth Layer WebSocket Implementation

## Initial Prompt
Implement a websocket server on the bitvocation-demo nuxt app server that connects to the CouchDB _users database and streams user document changes to the logged in users that are connected.

## Implementation Summary
Successfully implemented a production-ready WebSocket server within the **auth layer** that provides real-time user document changes from CouchDB's `_users` database to authenticated WebSocket clients.

### Key Components Implemented:

1. **Enhanced Nuxt Configuration** (`layers/auth/nuxt.config.ts`)
   - Enabled WebSocket support with `nitro.experimental.websocket: true`
   - Added CouchDB runtime config for URL and admin authentication

2. **Session Validation Utility** (`layers/auth/server/utils/couchSession.ts`)
   - Reuses existing CouchDB utilities from database layer
   - Validates AuthSession cookies for WebSocket authentication
   - Extracts user information from CouchDB session responses

3. **Users Hub** (`layers/auth/server/utils/usersHub.ts`)
   - Manages WebSocket connections mapped by username
   - Provides centralized broadcasting to user-specific connections
   - Handles connection registration/cleanup with detailed logging

4. **Document Sanitization** (`layers/auth/server/utils/sanitizeUserDoc.ts`)
   - Removes sensitive authentication fields (passwords, keys, salts)
   - Ensures only safe user data is transmitted over WebSocket
   - Maintains document structure while filtering security risks

5. **Global Changes Follower** (`layers/auth/server/plugins/usersChanges.global.ts`)
   - Single global connection to CouchDB `_users/_changes` feed
   - Auto-reconnecting with exponential backoff (1s → 30s max)
   - Processes continuous stream and fans out to appropriate WebSocket connections
   - Filters for `org.couchdb.user:*` documents only

6. **WebSocket Route Handler** (`layers/auth/server/routes/ws.ts`)
   - Authenticated WebSocket endpoint at `/ws`
   - Uses existing AuthSession cookies for authentication
   - Implements heartbeat/ping-pong for connection health
   - Proper error handling and connection lifecycle management

### Security Features:
- **Authentication Required**: All WebSocket connections must have valid AuthSession cookies
- **User Isolation**: Users only receive notifications for their own user document changes
- **Data Sanitization**: Sensitive fields are automatically removed before transmission
- **Proper Error Handling**: Unauthorized connections are immediately rejected with descriptive errors

### Testing Results:
- ✅ WebSocket server starts successfully with development server
- ✅ Global `_changes` follower connects to CouchDB successfully
- ✅ Authentication properly rejects invalid sessions with code 1008
- ✅ Error messages are properly formatted and informative
- ✅ Connection lifecycle is properly managed with logging

## Documentation Overview

The WebSocket functionality is now a **core feature of the auth layer**, automatically available to any consuming application that extends the auth layer. This maintains the layer's design principle of providing complete authentication-related functionality.

### Architecture Benefits:
- **Single Responsibility**: Auth layer manages all user-related real-time updates
- **Automatic Availability**: Any app extending auth layer gets WebSocket functionality
- **Code Reuse**: Leverages all existing CouchDB utilities and session management
- **Consistency**: Follows established auth layer patterns and conventions

### Protocol:
- **Endpoint**: `ws://domain/ws` or `wss://domain/ws`
- **Authentication**: AuthSession cookies (same as HTTP API)
- **Message Format**: JSON with `type` field for message routing

## Implementation Examples

### Client Connection:
```javascript
const ws = new WebSocket('ws://localhost:3000/ws');

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  
  switch (message.type) {
    case 'connected':
      console.log('Connected as:', message.user.name);
      break;
      
    case 'user-change':
      console.log('User profile updated:', message.doc);
      // Update UI with new user data
      updateUserProfile(message.doc);
      break;
      
    case 'ping':
      // Server heartbeat - connection healthy
      break;
  }
};
```

### Server Message Example:
```json
{
  "type": "user-change",
  "id": "org.couchdb.user:bv-abc123",
  "seq": "7-g1AAAAE...",
  "doc": {
    "_id": "org.couchdb.user:bv-abc123",
    "_rev": "5-...",
    "name": "bv-abc123",
    "roles": ["member"],
    "email": "user@example.com",
    "profile": { "displayName": "John Doe" }
  },
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

### Environment Configuration:
```bash
# Required for WebSocket functionality
COUCHDB_URL=http://localhost:5984
COUCHDB_ADMIN_AUTH=YWRtaW46cGFzc3dvcmQ=  # base64(admin:password)
```

The implementation provides a robust, secure, and scalable solution for real-time user document synchronization that integrates seamlessly with the existing authentication infrastructure.