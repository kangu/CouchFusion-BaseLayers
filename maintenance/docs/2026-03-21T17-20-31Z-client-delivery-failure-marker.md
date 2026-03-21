# Client Delivery Failure Marker (Computed)

## Summary
Implemented a computed customer delivery failure marker for the clients list.

## Behavior
- A client is marked with delivery `failed` when there is at least one historical notification document with:
  - `status = failed`
  - `recipientRole = customer`
  - `relatedId = client._id`
- The marker is computed at read time and is not persisted on client documents.
- Client lifecycle status values remain unchanged.

## Changes
- Added CouchDB view `notifications_failed_customer_by_client` in maintenance design doc.
- Updated clients API to compute and return `hasCustomerDeliveryFailure`.
- Updated clients admin table to display `Delivery` indicator (`failed` / `ok`).

## Verification
- `bun run build` from `apps/gas-maintenance` completed successfully.
