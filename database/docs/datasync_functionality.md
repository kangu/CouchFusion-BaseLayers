## Goal
The entry page of the Data Sync page should have a huge banner for configuring a remote host over http S, and a username and password for authentication.

Once the configuration is set, the system does client side HTTP requests with the basic authentication header to pass through and then using CouchDB API to first query for _all_dbs and return to the UI in a nicely formatted table.

## Progress
- [x] Add a banner UI with remote host + username + password inputs stored in local storage.
- [x] Fetch `_all_dbs` client-side with Basic Auth and render results in a table.

## New tasks
- Implement a server API route for /datasync/db-info/:db_name which queries the remote database for information about the specified database. Like /[dbname]. The result looks like this:
```json
{
    "instance_start_time": "1764025202",
    "db_name": "bv--meetups",
    "update_seq": "53-g1AAAACbeJzLYWBgYMpgTmEQTM4vTc5ISXIwNDLXMwBCwxyQVB4LkGRoAFL_gSArgzlRKhcowG5iYGxinmqKTR8e0xIZkuqhxkiDjUlNNU4yMkjGpiELAN-XKHs",
    "sizes": {
        "file": 242076,
        "external": 10737,
        "active": 21217
    },
    "doc_count": 35
}
```

On the client side, once the remote databases have been fetched, run an async iterative process to query the database information for each of the databases in the list, and then populate the table with the columns and data that is fetched.

Use inline discrete spinners for loading status on each of the tables.

## Progress
- [x] Implement `/api/datasync/db-info/:db_name` to fetch remote database info with Basic Auth.
- [x] Iteratively fetch per-db info after `_all_dbs` and populate the table with inline spinners.

## New tasks
- Fetch local CouchDB db info alongside remote using local admin credentials.
- Highlight doc_count and update_seq values when local and remote differ, and show stacked local/remote values.

## Progress
- [x] Fetch local database info from runtimeConfig.couchUrl and compare against remote values.
- [x] Stack local + remote values in the Docs and Update Seq columns and highlight mismatches.

## New tasks
- Add a Replicate Down button per row to trigger remote → local replication using CouchDB _replicator.
- Surface replication progress and errors/warnings by polling _active_tasks.

## Progress
- [x] Create replication endpoints for creating jobs and checking status with _active_tasks polling.
- [x] Add per-row Replicate Down actions with status feedback in the UI.

## New tasks
- Add compare-docs API to list doc ids + revs for local/remote and determine status.
- Add a dialog with search and pagination to view document comparison results.

## Progress
- [x] Implement compare-docs server endpoint with search + pagination and status counts.
- [x] Add Compare Docs action and HTML dialog with paginated table in the Data Sync UI.

## New task
When the remote host username and password are set on the Datasync page show a banner at the top for the host and a refresh button to the right and only expand to full layout with input boxes under an edit link.

## Progress
- [x] Show a compact configured-host banner with Refresh + Edit controls.
- [x] Collapse the full input form until Edit is clicked; Refresh re-runs the full data fetch.
