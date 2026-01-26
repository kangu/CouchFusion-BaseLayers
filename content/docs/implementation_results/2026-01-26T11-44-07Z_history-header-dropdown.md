# Context
- Layer: `layers/content`
- Component: `app/components/admin/ContentAdminWorkbench.vue`
- Goal: Move history selection into the header as an icon-only dropdown and remove sidebar/condensed history UI.

# Changes
- Removed the sidebar/condensed history panes and associated responsive logic; the workbench body now runs single-column without container queries.
- Added a history icon button alongside Save/Delete/Clone that opens a custom dropdown menu listing “Current version” and past saves; handles loading/error/empty states.
- Implemented outside-click/Escape closing and reused existing history selection logic (`handleSelectHistory`) for menu actions.
- Added styles for the compact dropdown and cleaned up unused sidebar styles.

# Verification
- Manual: Opened ContentAdminWorkbench, toggled the new history dropdown, and selected different versions; history selection still triggers store fetch/selection and the menu closes after choosing an entry. No automated tests run.***
