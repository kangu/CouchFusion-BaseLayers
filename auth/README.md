# Authentication proxy module for CouchDB API

Its purpose is to interact with the native _session API and build on top of it.

Main authentication method is through a email tokens sent over for confirmation. Password authentication is specifically avoided in favor of authenticating directly through an external service.

Unique couchdb user id are randomly generated for each user. The actual authentication is performed by the server api by generating a new random unique password (which is does not store), set the new user account to that password (using the same salt as the existing one) and logging the user in through passing the AuthSession cookie to the client.

The client basically logs in with an email, and its user document is { _id: "user-pZ3YwF9nq6JcK", email: "hello@yo.com" }.

## Configuration Requirements

This auth layer requires the following configuration in your consuming application's `nuxt.config.ts`:

```ts
export default defineNuxtConfig({
  extends: ["path/to/auth/layer"],
  
  runtimeConfig: {
    // REQUIRED: Prefix for generated user IDs
    dbLoginPrefix: 'your-app-prefix-',
    
    // ... other config
  }
})
```

### Required Configuration Options

- **`dbLoginPrefix`** (string, required): A prefix used when generating unique user IDs. This helps distinguish users from different applications when using shared CouchDB instances. 
  - Example: `'myapp-'`, `'prod-'`, `'dev-'`
  - Will be prepended to randomly generated IDs: `myapp-pZ3YwF9nq6JcK`

### Required Environment Variables

- **`COUCHDB_ADMIN_AUTH`** (string, required): Base64-encoded admin credentials for CouchDB access.
  - Format: `base64(username:password)`
  - Example: `COUCHDB_ADMIN_AUTH=YWRtaW46cGFzc3dvcmQ=` (admin:password)
  - Used for: Creating design documents in the `_users` database during server startup

### Environment Variable Setup

Create a `.env` file in your project root:

```env
# CouchDB admin credentials (base64 encoded)
COUCHDB_ADMIN_AUTH=YWRtaW46cGFzc3dvcmQ=
```

To generate the base64 string:
```bash
# Linux/Mac
echo -n "admin:password" | base64

# Node.js
Buffer.from("admin:password").toString('base64')
```

### Initialization Process

On server startup, the auth layer will:

1. **Validate configuration** - Check that all required config and environment variables are present
2. **Connect to CouchDB** - Test connection to the `_users` database using admin credentials  
3. **Create design document** - Push a design document with email-based views for user queries
4. **Log status** - Provide clear feedback about the initialization process

The layer will validate all requirements at build time and throw descriptive errors if anything is missing.

## WebSocket Real-time User Changes

The auth layer now includes built-in WebSocket support for real-time user document changes from CouchDB's `_users` database.

### Features

- **Real-time Updates**: Instantly receive user document changes (profile updates, role changes, etc.)
- **Secure**: Users only receive updates for their own user documents
- **Authenticated**: Uses existing AuthSession cookies for WebSocket authentication
- **Resilient**: Auto-reconnecting with exponential backoff
- **Scalable**: Single global `_changes` follower fans out to multiple WebSocket connections

### WebSocket Endpoint

Connect to: `ws://your-domain/ws` or `wss://your-domain/ws`

### Authentication

WebSocket connections must include the `AuthSession` cookie in the connection headers. The same session cookies used for HTTP API authentication work for WebSocket connections.

### Message Types

**Client → Server:**
```javascript
// Ping for connection health
{ "type": "ping" }

// Get connection status
{ "type": "get_status" }
```

**Server → Client:**
```javascript
// Connection established
{
  "type": "connected",
  "user": { "name": "user-abc123", "roles": ["member"] },
  "timestamp": "2024-01-15T10:30:00.000Z",
  "message": "Connected to user changes stream"
}

// User document changed
{
  "type": "user-change",
  "id": "org.couchdb.user:user-abc123",
  "seq": "7-g1AAAAE...",
  "doc": {
    "_id": "org.couchdb.user:user-abc123",
    "_rev": "5-...",
    "name": "user-abc123",
    "roles": ["member"],
    "email": "user@example.com",
    "profile": { "displayName": "John Doe" }
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}

// Heartbeat
{ "type": "ping", "timestamp": "2024-01-15T10:30:00.000Z" }

// Connection status
{
  "type": "status",
  "user": "user-abc123",
  "stats": { "totalUsers": 5, "totalConnections": 8 },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Client Implementation Example

```javascript
// Connect to WebSocket with existing auth cookies
const ws = new WebSocket('ws://localhost:3000/ws');

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  
  switch (message.type) {
    case 'connected':
      console.log('Connected as:', message.user.name);
      break;
      
    case 'user-change':
      console.log('User document updated:', message.doc);
      // Update UI with new user data
      break;
      
    case 'ping':
      // Server heartbeat - connection is healthy
      break;
  }
};

ws.onopen = () => {
  console.log('WebSocket connected');
  
  // Request status
  ws.send(JSON.stringify({ type: 'get_status' }));
};

ws.onclose = (event) => {
  console.log('WebSocket closed:', event.code, event.reason);
  // Implement reconnection logic if needed
};
```

### Security Notes

- WebSocket connections require valid AuthSession cookies
- Users only receive notifications for changes to their own user documents
- Sensitive authentication fields (passwords, keys, salts) are automatically filtered out
- Connection attempts without valid authentication are immediately rejected

### Environment Variables

The WebSocket functionality uses the same environment variables as the auth layer:

- `COUCHDB_URL` - CouchDB server URL (default: `http://localhost:5984`)
- `COUCHDB_ADMIN_AUTH` - Base64 encoded admin credentials for accessing `_users` changes feed
