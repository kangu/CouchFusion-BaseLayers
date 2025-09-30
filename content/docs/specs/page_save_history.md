- [x] We are implementing a feature that allows editors to access the 3
previously saved templates for each page.

- [x] Next to the Save Changes button, there should be a dropdown that displays the timestamp of the save,
and selecting one of the options would load the body contents into the local v-model mutable value.

- [x] After each page save, go through a "history" procedure where you save the exact same document but
with the _id starting with "oldpage-" instead of "page-".

- [x] Create a view in the content module CouchDB design-documents.ts that returns these "old" pages by
timestamp and use that to both return to the users the list, and to impose the maximum number of
previously kept saves.
