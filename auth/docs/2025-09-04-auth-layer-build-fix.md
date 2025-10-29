# Auth Layer Build Process Fix

## Initial Prompt
Something in the auth layer is preventing the "bun run build" process to finish. When I take out the layer from the main "extends" section, the project builds. With the layer inside, it doesn't build. Investigate and propose a fix.

## Implementation Summary

**Problem Identified:**
The auth layer's `server/plugins/usersChanges.global.ts` plugin was creating persistent connections to CouchDB's `_changes` feed during the build process. This plugin establishes a continuous connection with an infinite loop and auto-reconnection that never terminates, causing the build process to hang after completion.

**Root Cause:**
- The `usersChanges.global.ts` Nitro plugin runs during both build-time and runtime
- It creates a persistent HTTP connection to CouchDB's `_changes` feed using `fetch()` with a continuous stream
- The plugin includes an infinite loop (`for (;;)`) to process the stream and automatic reconnection logic
- These persistent connections prevent the Node.js process from naturally terminating after the build completes

**Solution Implemented:**
Modified `layers/auth/server/plugins/usersChanges.global.ts` to skip initialization during build/prerendering phases by adding environment detection:

```typescript
export default defineNitroPlugin(() => {
  // Skip during build/prerendering to prevent hanging
  if (process.env.prerender || process.env.NITRO_PRESET) {
    console.log('[UsersChanges] Skipping during build/prerendering phase')
    return
  }

  // ... rest of the plugin code
})
```

**Validation:**
- Build now completes successfully with auth layer included
- All database initialization, design documents, and webhook setup still works properly
- Runtime functionality preserved - the plugin will still run normally in development and production servers
- Build process terminates cleanly without hanging

## Documentation Overview

### Problem Context
NuxtJS layers can include server plugins that run during different phases of the application lifecycle. When these plugins create persistent connections or long-running processes, they can interfere with the build process by preventing the Node.js event loop from emptying, which prevents process termination.

### Technical Details

**Affected File:** `layers/auth/server/plugins/usersChanges.global.ts`

**Plugin Purpose:**
- Creates a global CouchDB `_users` database changes follower
- Establishes persistent connection to CouchDB's `_changes` feed
- Broadcasts user document changes to connected SSE clients
- Includes auto-reconnection with exponential backoff

**Build vs Runtime Behavior:**
- **Build Time**: Plugin should not establish persistent connections
- **Runtime**: Plugin should run normally to provide real-time user updates

### Implementation Examples

#### Environment Detection Pattern
```typescript
export default defineNitroPlugin(() => {
  // Skip during build/prerendering to prevent hanging
  if (process.env.prerender || process.env.NITRO_PRESET) {
    console.log('[Plugin] Skipping during build/prerendering phase')
    return
  }

  // Runtime initialization code here
})
```

#### Build Output Indicators
**Before Fix (Hanging):**
- Build completes all steps but process never exits
- No final summary or exit codes
- Process must be manually killed

**After Fix (Success):**
```
[UsersChanges] Skipping during build/prerendering phase
[nitro] ✔ You can preview this build using node dist/output/server/index.mjs
Σ Total size: 12.2 MB (3.49 MB gzip)
```

### Best Practices

1. **Environment Detection**: Always check for build/prerender context in server plugins that create persistent connections
2. **Graceful Skipping**: Log when skipping initialization for debugging purposes
3. **Preserve Runtime**: Ensure the fix doesn't affect normal application runtime behavior
4. **Connection Management**: Be mindful of persistent connections in Nitro plugins during build phases

### Related Considerations

- This pattern applies to any server plugin creating persistent connections (WebSocket, SSE, database change streams, etc.)
- Environment variables `process.env.prerender` and `process.env.NITRO_PRESET` are reliable indicators of build-time execution
- Runtime validation hooks (like those in `nuxt.config.ts`) are separate from persistent connection issues and may still be appropriate during build