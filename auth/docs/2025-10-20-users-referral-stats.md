## Initial Prompt
```
Implement the specs in docs/specs/users_referral_stats.md. Proceed step by step with each section and mark that in the spec document as it's done to be used as reference when resuming work at a future time. 
Ask me for anything that after evalulation, you are not so sure what decision to make. Strive for minimal impact on other areas of the applicaiton. Any time your confidence for taking an actions is < 80%, ask for clarification. Present implementation plan before proceeding on my instructions.
```

## Implementation Summary
Implementation Summary: Added a CouchDB referrals view, propagated referral counts into admin user data, and exposed a sortable "# Referred" column in the Bitvocation users table.

## Documentation Overview
- Introduced the `referrals` map/reduce view inside `_design/auth`, emitting each document’s `referred_by` username (without the `dbLoginPrefix`) and reducing with `_sum` to aggregate referral totals.
- Updated the `GET /api/users` handler to combine the new reduce output with `_all_docs`, stripping the configured prefix from every account name before attaching `referral_count` to the sanitized payload.
- Added TypeScript typings in the auth Pinia store so downstream consumers receive the numeric referral count with proper type hints.

## Implementation Examples
```ts
const referralsView = await getView('_users', 'auth', 'referrals', { group: true })

const rawName = stripPrefix(doc.name)
safeUserData.referral_count = referralsViewLookup[rawName] ?? 0
```
