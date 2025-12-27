Refactor the /admin/content route to include a button for "Create new page".
The functionality of the button should be similar to the one from the /builder route when using the
"+ New Page" button.

The Create New Page dialog should be reused between the two places where pages can be created from.

After creating a new page from /admin/content, automatically redirect to /k/${pageUrl} to begin editing.