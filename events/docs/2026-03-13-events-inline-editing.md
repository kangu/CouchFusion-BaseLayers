# Events Inline Editing

## Scope
Added conference inline editing workflow:
- `PATCH /api/events/conferences/:id`
- UI editor panel in `/admin/events/conferences`

## Editable Fields
- Grouped editor sections:
  - Identity & Publication
  - Links & Contact
  - Schedule & Geography
  - Commercial & Performance
  - Internal Notes & TODO
  - Source & Audit Metadata
- Supports all conference business fields from `ConferenceDocument`, including:
  - Identity: `name`, `slug`, `year`, `status`, `bitvocationParticipation`, `isPublished`
  - Links/contact: `websiteUrl`, `xAccountUrl`, `contactName`, `contactChannel`
  - Schedule/location: `startDateIso`, `startDateLabel`, `monthLabel`, `dateRangeLabel`, `location`, `city`, `country`, `continent`, `confirmedDates`, `hasAirtable`
  - Commercial: `discountCode`, `discountLabel`, `commissionLabel`, `ticketsSold`, `commissionEarnedLabel`, `commissionReceived`
  - Internal: `ownerTodo`, `notes`
  - Source/audit: `source.format`, `source.rowNumber`, `source.importedAt`, `createdAt`, `updatedAt`
- Immutable document identity shown read-only in editor:
  - `_id`, `_rev`, `type`

## Access
- Secured via events auth guard:
  - admin session required
