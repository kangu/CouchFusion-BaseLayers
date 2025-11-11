## Initial Prompt
I have reverted the changes, there's no need to rename couchdb.ts. Replace the crypto hmac usage inside couchdb.ts with @noble/hashes package

## Implementation Summary
Replaced the CouchDB helper’s Node `crypto` HMAC/timing utilities with @noble/hashes-powered helpers so AuthSession cookies can be generated and verified without bundling the Node crypto polyfill.

## Documentation Overview
- Updated `utils/couchdb.ts` to import `@noble/hashes` (HMAC + SHA-1/SHA-256) and added shared helpers (`TextEncoder`, `computeHmac`, `timingSafeEqual`) used by AuthSession generation/verification.
- Removed direct calls to `crypto.createHmac` / `crypto.timingSafeEqual`, keeping the public API the same for consuming layers while making the implementation browser-safe.
- Declared `@noble/hashes` in `layers/package.json` and reinstalled dependencies with `bun install` so the new helper is available to every app that extends the database layer.

## Implementation Examples
```ts
import { hmac } from '@noble/hashes/hmac'
import { sha1 } from '@noble/hashes/sha1'
import { sha256 } from '@noble/hashes/sha256'

const timingSafeEqual = (a: Uint8Array | Buffer, b: Uint8Array | Buffer) => {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i += 1) result |= a[i] ^ b[i]
  return result === 0
}
```
