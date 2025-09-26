The CouchDB module should implement a function getView() which maps to the CouchDB design docs _view API.
The requests made are always POST, with the query parameters passed in the json body.

Accept all query parameters as per the API spec at https://docs.couchdb.org/en/stable/api/ddoc/views.html#db-design-ddoc-view-view.
Should create TS interfaces for query parameter and response json object.


│ ╭───────────────────────────────────────────────────────────────────────────────────────────────────────────╮ │
│ │ Plan: Implement CouchDB View Query Functionality                                                          │ │
│ │                                                                                                           │ │
│ │ Goal: Add getView() function to utils/couchdb.ts following the specifications in couchdb_view.md          │ │
│ │                                                                                                           │ │
│ │ Implementation Steps:                                                                                     │ │
│ │                                                                                                           │ │
│ │ 1. Add TypeScript interfaces for CouchDB view query parameters and responses:                             │ │
│ │   - CouchDBViewQueryParams - Interface covering all 26 query parameters from the CouchDB API spec         │ │
│ │   - CouchDBViewResponse - Interface for the JSON response structure                                       │ │
│ │   - CouchDBViewRow - Interface for individual row structure in view results                               │ │
│ │ 2. Implement getView() function:                                                                          │ │
│ │   - Function signature: getView(databaseName, designDocName, viewName, queryParams?, config?)             │ │
│ │   - Always use POST requests (as specified in requirements)                                               │ │
│ │   - Pass query parameters in JSON body (not URL query string)                                             │ │
│ │   - Include proper error handling consistent with existing functions                                      │ │
│ │   - Use existing couchDBRequest function for authentication and consistent HTTP handling                  │ │
│ │ 3. Key Requirements:                                                                                      │ │
│ │   - Map to CouchDB design docs _view API endpoint: /{db}/_design/{ddoc}/_view/{view}                      │ │
│ │   - Support all query parameters from CouchDB API spec (descending, limit, skip, include_docs, etc.)      │ │
│ │   - Use POST method with JSON body (as specified in requirements)                                         │ │
│ │   - Return properly typed response with view results                                                      │ │
│ │   - Maintain consistency with existing error handling patterns                                            │ │
│ │ 4. Integration:                                                                                           │ │
│ │   - Follow existing code patterns (similar to getDocument, putDocument)                                   │ │
│ │   - Use existing getCouchDBConfig and couchDBRequest utilities                                            │ │
│ │   - Add proper TypeScript typing throughout                                                               │ │
│ │   - Include JSDoc documentation                                                                           │ │
│ │                                                                                                           │ │
│ │ Technical Details:                                                                                        │ │
│ │ - The function will POST to /{database}/_design/{designDoc}/_view/{viewName}                              │ │
│ │ - Query parameters will be passed in request body as JSON                                                 │ │
│ │ - Response will include total_rows, offset, rows array with key/value/doc fields                          │ │
│ │ - Error handling will follow existing patterns (return null for not found, throw for other errors) 
