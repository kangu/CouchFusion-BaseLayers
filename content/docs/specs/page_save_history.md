- [x] We are implementing a feature that allows editors to access the 5
previously saved templates for each page.

- [x] Next to the Save Changes button, there should be a dropdown that displays the timestamp of the save,
and selecting one of the options would load the body contents into the local v-model mutable value.

- [x] After each page save, go through a "history" procedure where you save the exact same document as a
CouchDB `_local` document with an id shaped like `_local/page-[page]-[timestamp]`.

- [x] Store a per-page `_local/page-history-index-...` document that returns these old pages by timestamp
and use that to both return the list to users and impose the maximum number of previously kept saves.
