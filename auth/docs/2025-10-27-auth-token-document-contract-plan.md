# Auth Token Document Contract Plan

## Initial Prompt
Review the functionality from layers/auth/server/api/login.post.ts and propose a way to define the token document interface in a generic way that is not tied to the current bitvocation-demo implementation. Don't write any code, just tell me what the plan is

## Implementation Summary
Implementation Summary: Pending implementation — plan only, no code generated yet.

## Documentation Overview
- **Objective**: decouple the login token document schema from application-specific fields so the auth layer provides a reusable base that other products can extend safely.
- **Scope**: introduce a shared base interface for token documents, extension points for optional metadata (affiliate, funnel, or custom attributes), validation guidance, and documentation to steer future implementations.
- **Key Concepts**:
  - Base contract lives alongside other CouchDB typings in the auth layer.
  - Feature-specific traits extend the base interface without polluting it.
  - Helper utilities become generic to preserve additional properties supplied by consuming apps.
  - Validation responsibilities split: auth layer enforces base contract, callers validate their own extensions.

## Implementation Examples
- **Base Type Definition**  
  Declare `AuthTokenDocBase` with the minimal fields (`_id`, `email`, `code`, `expires`, `used`, timestamps) in `layers/auth/server/utils` next to existing CouchDB types; export it for reuse across auth endpoints.

- **Extensible Contracts**  
  Model optional capabilities as interface extensions, e.g. `interface AuthTokenDocWithAffiliate extends AuthTokenDocBase { affiliateFriendCode: string }`, allowing each app or layer to compose what it needs.

- **Generic Helpers**  
  Update token persistence helpers to accept generics: `function createAuthTokenDoc<T extends AuthTokenDocBase>(doc: T): Promise<T>`, ensuring the base fields exist while carrying through custom keys.

- **Validation Strategy**  
  Pair interfaces with a lightweight validator or type guard that checks only the base shape; document that consumers must validate their own extensions before passing docs into auth utilities.

- **Documentation & Tooling**  
  Capture these contracts and extension patterns in the shared docs so future contributors can follow the same approach when introducing new token metadata.
