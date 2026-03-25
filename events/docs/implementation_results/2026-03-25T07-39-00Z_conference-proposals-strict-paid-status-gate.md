# Initial Prompt
Enforce strict backend gate for conference proposal creation: only create proposal when profile payment status indicates paid.

# Plan
1. Read current authenticated user document from `_users`.
2. Require `conference_submission_status` to be `paid` before insert.
3. Keep proposal insertion unchanged otherwise.
4. Consume the payment status after successful creation.

# Implementation Summary
- Updated [index.post.ts](/Users/radu/Projects/nuxt-apps/layers/events/server/api/events/conference-proposals/index.post.ts) to load the persisted `_users` document and enforce:
  - `conference_submission_status === "paid"`.
- Added explicit 402 response when unpaid.
- After successful proposal creation, user payment fields are consumed/reset:
  - `conference_submission_status: "pending"`
  - `conference_submission_invoice: ""`
- Wrapped consume step in best-effort try/catch to avoid failing a successfully-created proposal.

# Validation
- Manual code-path inspection confirms gate runs before proposal persistence and status consume runs after.

# Proposed Next Steps
1. Add endpoint tests for unpaid vs paid behavior and post-create status consume.
2. Decide whether consume-failure should be retried asynchronously for guaranteed one-payment-per-submission semantics.
