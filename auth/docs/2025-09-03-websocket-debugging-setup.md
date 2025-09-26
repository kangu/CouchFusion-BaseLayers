# WebSocket Debugging Setup

## Issue Summary
WebSocket authentication failing because **all peer object properties are undefined**:
- `peer.req?.url: undefined`
- `peer.req?.headers: undefined` 
- `peer.headers: undefined`
- `peer.protocol: undefined`

This suggests a fundamental issue with WebSocket handler API usage or peer object structure.

## Debugging Tools Created

### 1. **Enhanced Main WebSocket Handler** (`/layers/auth/server/routes/ws.ts`)
- Complete peer object exploration with type checking
- Loops through all enumerable properties
- Checks prototype and constructor information
- Logs connection attempts with timestamps

### 2. **Simple Test WebSocket Handler** (`/layers/auth/server/routes/ws-test.ts`)
- Minimal WebSocket handler for API testing
- Tests basic peer object functionality
- Attempts to send/receive messages
- Explores all possible peer properties

### 3. **Client-Side Debug Functions** (`/apps/bitvocation-demo/composables/useUserChanges.ts`)
- Added `testConnect()` function for basic WebSocket testing
- Enhanced logging for connection attempts
- Detailed WebSocket state tracking

### 4. **Debug Web Page** (`/apps/bitvocation-demo/pages/debug-websocket.vue`)
- Browser interface for testing WebSocket connections
- Buttons to test different WebSocket endpoints
- Instructions for using browser console

## Testing Instructions

### Step 1: Access Debug Page
1. Start the server: `npm run dev -- --port 9900`
2. Open browser to: `http://localhost:9900/debug-websocket`
3. Open browser console (F12)

### Step 2: Test Basic WebSocket
1. Click "Test Basic WebSocket (/ws-test)" button
2. Watch browser console for client-side logs
3. Watch server console for peer object exploration

### Step 3: Analyze Output

**Expected Client Console:**
```
[DEBUG] Testing basic WebSocket connection...
[DEBUG] Connecting to: ws://localhost:9900/ws-test
[DEBUG] Basic WebSocket opened
[DEBUG] Basic WebSocket message: {"type":"test","message":"Test connection successful"}
```

**Expected Server Console:**
```
[WSTest] === SIMPLE TEST HANDLER ===
[WSTest] Connection received at: 2025-09-03T07:00:00.000Z
[WSTest] Peer type: object
[WSTest] All peer keys: [array of available properties]
[WSTest] peer.req: [object or undefined]
[WSTest] peer.headers: [object or undefined]
```

### Step 4: Identify Root Cause
The debug output will show:
- What properties are actually available on the peer object
- Whether the WebSocket connection is reaching our handler
- What the correct API structure should be

## Possible Issues and Solutions

### Issue 1: API Version Mismatch
**Symptoms:** All peer properties undefined
**Solution:** Update to correct API usage based on actual peer structure

### Issue 2: WebSocket Route Not Working  
**Symptoms:** No server logs, connection fails
**Solution:** Fix route registration or Nitro configuration

### Issue 3: Peer Object Structure Changed
**Symptoms:** Properties exist but under different names
**Solution:** Update property access based on debug output

### Issue 4: Network/Connection Issue
**Symptoms:** Connection errors in browser
**Solution:** Check WebSocket URL construction and server setup

## Next Steps Based on Results

1. **If test WebSocket works:** Compare working vs broken implementations
2. **If both fail:** Check Nitro WebSocket configuration
3. **If peer has different properties:** Update authentication logic
4. **If connection fails:** Investigate network/routing issues

The debugging setup will provide complete visibility into what's happening with the WebSocket connection and peer object structure.