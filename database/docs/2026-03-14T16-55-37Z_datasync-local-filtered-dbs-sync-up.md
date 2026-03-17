## Initial Prompt
For the /admin/datasync functionality, I only see the remote DBs that have been created. There are also some local dbs which i might want to sync up to the remote. Introduce this functionality.

## Plan
1. Extend `/api/datasync/remote-dbs` to return a filtered union of local and remote databases while keeping the same prefix filter (`dbLoginPrefix + "-"`) and `_users` allowance.
2. Add replication direction support in `/api/datasync/replicate` so the admin page can run both `remote -> local` and `local -> remote` jobs.
3. Update `/api/datasync/replication-status/[db_name]` to read status per direction so up/down jobs do not overwrite each other.
4. Update `/admin/datasync` UI to:
   - display the merged managed database list,
   - expose both `Replicate Down` and `Replicate Up` actions,
   - show independent progress/error states for each direction,
   - allow pushing local-only filtered databases to remote.
5. Keep existing compare-doc tooling unchanged and preserve current auth/host flow.

## Implementation Summary
Implemented local-database-aware sync in the database layer without changing app-specific code.

### API changes
- Updated `layers/database/server/api/datasync/remote-dbs.post.ts`:
  - fetches both remote and local `_all_dbs`;
  - applies the same managed filter on both sides (`_users` + `dbLoginPrefix + "-"`);
  - returns:
    - `databases`: sorted union list,
    - `remoteDatabases`: filtered remote list,
    - `localDatabases`: filtered local list.
- Updated `layers/database/server/api/datasync/replicate.post.ts`:
  - accepts `direction?: "down" | "up"` (defaults to `down`);
  - builds directional replicator IDs (`datasync-down-<db>`, `datasync-up-<db>`);
  - `down`: source remote, target local;
  - `up`: source local, target remote;
  - keeps `create_target: true` for both directions.
- Updated `layers/database/server/api/datasync/replication-status/[db_name].get.ts`:
  - accepts query `direction=down|up` (defaults to `down`);
  - resolves status against directional replicator ID;
  - returns direction-aware status payload.

### UI changes
- Updated `layers/database/pages/admin/datasync.vue`:
  - reads and stores `remoteDatabases` + `localDatabases` from API response;
  - keeps DB table source as merged `databases` list;
  - adds directional replication keying (`<db>:down`, `<db>:up`) for loading/status/polling;
  - adds `Replicate Up` button next to existing `Replicate Down`;
  - disables actions when source side does not exist (`down` requires remote DB, `up` requires local DB);
  - shows independent progress and error lines for both directions.

## Next Steps
1. In `/admin/datasync`, fetch databases and verify local-only filtered DBs now appear in the table.
2. For a local-only DB, click `Replicate Up` and confirm it is created/populated on remote.
3. For a remote-only DB, click `Replicate Down` and confirm local population still works.
4. Optionally clean up old non-directional `_replicator` docs (`datasync-<db>`) if they are no longer needed.
