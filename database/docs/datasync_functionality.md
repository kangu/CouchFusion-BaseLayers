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

## New task
When the remote host username and password are set on the Datasync page show a banner at the top for the host and a refresh button to the right and only expand to full layout with input boxes under an edit link.