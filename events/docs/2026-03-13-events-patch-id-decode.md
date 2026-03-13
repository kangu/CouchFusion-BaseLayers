# Events PATCH ID Decode Fix

## Scope
Fixed encoded conference id handling in PATCH endpoint.

## Endpoint
- `PATCH /api/events/conferences/:id`

## Change
- Updated route param retrieval to decode URL value:
  - `getRouterParam(event, 'id', { decode: true })`

## Why
Without decode, ids containing encoded special chars (such as `:`) failed CouchDB lookup and returned `Conference not found` even when documents existed.
