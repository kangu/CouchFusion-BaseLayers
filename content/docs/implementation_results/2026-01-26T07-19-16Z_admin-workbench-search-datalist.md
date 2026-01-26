# Context
- Layer: `layers/content`
- Component: `app/components/admin/ContentAdminWorkbench.vue`
- Goal: Replace page selection chips with an autocomplete search (datalist) and surface total page count in the placeholder.

# Changes
- Replaced chip list buttons with a single search input wired to a `<datalist>` of all pages (option text shows `path — title`, value is path). Selecting/entering a path or exact title opens the page; unmatched entries leave the current selection unchanged.
- Placeholder now reflects total page count and shows a loading hint when the index is pending.
- Search control spans full available width; chip list UI removed while keeping error/empty guidance inline with the search row.

# Verification
- Manual: Ensured the search input renders with datalist options populated from the page index, placeholder displays count, and selecting an option triggers `openPageForEditing` without affecting selection on invalid entries. No automated tests run.***
