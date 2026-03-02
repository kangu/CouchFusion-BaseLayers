# Initial Prompt
The upload image functionality from the select local image dialog doesn't seem to work in production. Add debugging code to the server handling the upload to trace down the problem (entry point is triggerLocalUpload function)

# Plan Followed
1. Trace `triggerLocalUpload` client flow to the server upload endpoint.
2. Add detailed server-side diagnostics in the local image upload handler.
3. Keep diagnostics production-safe and controllable with an environment flag.
4. Preserve normal behavior while improving failure visibility.

# Implementation Summary
Added structured debugging instrumentation to the local image upload endpoint:
- `layers/content/server/api/content/local-images/index.post.ts`

What was added:
- Request metadata capture: method, URL, content type/length, user-agent, forwarded IP, `NODE_ENV`, `cwd`.
- Debug logging helper gated by env var:
  - `CONTENT_LOCAL_UPLOAD_DEBUG=1` (or `true`) enables verbose logs.
- Error logging helper:
  - failures are always logged with message/status/stack and request context.
- Stage-by-stage upload tracing (when debug enabled):
  - request received
  - auth accepted
  - multipart parsed (parts metadata)
  - file write target details
  - upload success output (path/url/size)

Behavior:
- Endpoint response contract is unchanged.
- Upload failures now produce actionable server logs for production diagnosis.

# Proposed Next Steps
1. In production, set `CONTENT_LOCAL_UPLOAD_DEBUG=1` temporarily and reproduce upload.
2. Inspect server logs for:
   - missing/incorrect multipart parts
   - wrong `cwd` / write path
   - filesystem permission errors at write time.
3. After root cause is found, disable verbose debug by unsetting `CONTENT_LOCAL_UPLOAD_DEBUG`.
