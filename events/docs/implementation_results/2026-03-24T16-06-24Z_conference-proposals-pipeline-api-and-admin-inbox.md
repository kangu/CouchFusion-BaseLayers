# Conference Proposals Pipeline (API + Admin Inbox)

## Scope
Introduced a conference proposal pipeline in the events layer so logged-in public users can submit proposal documents and admins/curators can review them in `/admin/events/conferences`.

## Changes
- Added proposal model utilities:
  - `type: "conference_proposal"`
  - statuses: `pending`, `accepted`, `rejected`
- Added API endpoints:
  - `POST /api/events/conference-proposals` (authenticated user submits proposal)
  - `GET /api/events/conference-proposals` (admin/curator list)
  - `PATCH /api/events/conference-proposals/:id` (admin/curator status update, soft reject/accept)
- Updated admin conferences page to include top-level `Conference Proposals` section:
  - Loads proposals and status counts.
  - Provides actions for pending proposals:
    - `Transform` (prefills Add Conference form)
    - `Reject` (soft reject)
  - On successful conference creation from a proposal, proposal is marked `accepted` and linked to the created conference id.

## Files
- `layers/events/server/utils/conference-proposal.ts`
- `layers/events/server/api/events/conference-proposals/index.post.ts`
- `layers/events/server/api/events/conference-proposals/index.get.ts`
- `layers/events/server/api/events/conference-proposals/[id].patch.ts`
- `layers/events/app/pages/admin/events/conferences.vue`

## Verification
- `cd apps/bitvocation && bun run build`
