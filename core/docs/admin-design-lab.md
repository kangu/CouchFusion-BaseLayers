# Admin design lab

Four directions for the core admin workspace, built as a static prototype in `design-lab/` before any of them moves into `src/features/admin`. Every direction renders the same eight screens from one sample dataset, so they can be compared screen by screen.

## Run it

```bash
node design-lab/build.mjs                       # regenerate the 32 pages and index.html
python3 -m http.server 4310 -d design-lab       # then open http://localhost:4310
```

`index.html` shows the four directions side by side with links to every screen. Nothing in `design-lab/` is loaded by the Nuxt layer.

## Files

| Path | Holds |
| --- | --- |
| `design-lab/shared/data.js` | The dataset. Database names, document counts and sizes are real (local CouchDB, 2026-10-28). Replication jobs, people, orders, visits and changes are sample data. Totals are computed from rows; figures that appear twice are checked with `console.assert`. |
| `design-lab/shared/render.js` | The three shells and the eight screens. Only the overview differs in composition per direction. |
| `design-lab/shared/base.css` | Structure and components, driven by tokens. |
| `design-lab/variants/*.css` | Each direction's tokens, shell and signature moves. `d-terminal-light.css` loads after `c-terminal.css` and only swaps tokens, so C and D cannot drift apart. |
| `design-lab/shared/charts.js` | SVG chart helper from the taste skill (bars, line, annotations). |

## The directions

Dealt with the taste skill's app run (`draw.mjs --app --kind devtools`) and kept whole; see each CSS file's header.

| | A · Framed sheet | B · Ledger | C · Terminal | D · Terminal light |
| --- | --- | --- | --- | --- |
| Theme | Light | Light | Dark | Light |
| Shell | Stone-tinted L-frame: sidebar and 48px search bar; work on one white sheet inset 8px, 16px corners | Open plane: labelled sidebar on the page ground, no top bar | Ruled T-frame: 64px top bar with the server switcher at its right end, labelled sidebar, 1px rules | Same as C |
| The move | Depth from one tone step, no shadows | No colour in the chrome; one blue (`#1d5fbf`) on the main data | Every selection is a 1px line in CouchFusion orange (`#f7931a`) | Same, with the line darkened to `#d27800` to keep 3:1 on white; the logo keeps `#f7931a` |
| Type | IBM Plex Sans; Plex Mono for database names, IDs and revisions | Geist | Public Sans; IBM Plex Mono for every figure | Same as C |
| Overview | Needs-attention strip, sites table, usage tray whose KPIs pick the chart | KPI strip led by live data, storage-by-site ledger, backups list, clean-up | The failing replication leads, health strip, write chart with the spike explained, jobs table | Same as C |
| Best for | Daily operations across many modules | Calm, reporting-first use and non-technical admins | Long monitoring sessions, operators | Same layout in daylight; with C it can ship as a light/dark theme pair |

One redraw: the dark style came with an unlabelled icon rail, which suits five destinations or fewer. CF Cloud has about nine, so it uses the ruled T-frame with labels.

**Shared signature element: the compaction gap.** Every database is drawn as its file on disk with the live data filled inside it, so space that compaction would reclaim is visible at a glance (`gapbar` in `base.css`). It appears on the overview (ledger), the databases list and the phone rows.

## Screens and their questions

| Screen | Question it answers first | Main action |
| --- | --- | --- |
| Overview | Is every site's data where it should be? | Retry replication |
| Databases | Which databases need compaction or clean-up? | Create database, compact |
| Database detail (`indux-orders`) | Is this database healthy and backed up? | Retry replication |
| Users | Who can sign in, and with which roles? | Invite user |
| Content builder | What changes on this page before it is published? | Publish |
| Orders (Bitvocation) | Which paid orders still need fulfilling? | Mark fulfilled |
| Analytics (radustanciu.ro) | Where did this month's visitors come from? | — (site and range selects) |
| Settings (`cf_env_cf-cloud`) | How is this workspace branded, signed into and guarded? | Save per section, restart workers |

The settings screen uses the real `cf_env_cf-cloud` keys and the real sign-in behaviour (the email method shows as "Not installed" because it is a build-time option).

## Checks (2026-10-28)

- `inspect.mjs --app` at 1440, 768 and 390 px: all 24 screens of A–C 0 FAIL, 0 WARN on the final run; the 8 Terminal light screens 0 FAIL, 0 WARN.
- `lint.mjs --app`: 0 FAIL, 13 WARN, each deliberate: monospace (each style's choice for IDs or figures), card shadows (the dark style's cards only), clock zero-padding, the login preview's brand line, and em dashes used as missing-value marks.
- Fixed along the way: unit suffixes under 11px, phone menu taking space while closed, ragged card rows, a cream page preview on dark, fake KPI tabs on the framed-sheet overview, colliding hour labels on phones.
- Browser checks: no console errors or failed data assertions; tabs, counts and hash links agree with the overview's figures; the phone menu opens as a sheet.

## Sample data to replace

Replication jobs and their states, the backup node name (`backup-01`), hourly writes, the 07:00 "Indux stock sync" spike, every person except `radu` and the two `cfcloud-qa-*` test users, all orders and the sats rate, all analytics figures and referrers, the content page tree and blocks, the recent `_changes` rows, design documents and security members of `indux-orders`.

## Shipped: the Terminal pair (2026-10-28)

C (dark) and D (light) are implemented in the layer as one design with a colour-scheme toggle: `src/features/ui-theme/` (tokens, `SchemeToggle.vue`, `CouchMark.vue`, `useCouchDBColorScheme.ts`), the admin shell (`admin-workspace.vue`), the overview (`admin/index.vue`, real people and roles from `/api/couchdb/admin/users`) and the login page. See `docs/implementation_results/2026-10-28-terminal-admin-theme.md`.

## Not built yet

Loading, error and empty states per block; dialogs (invite, create database, confirm compaction); the Vue implementation in `src/features/admin`. Moving the chosen direction into the layer is the next step: tokens become CSS custom properties on the admin layout, the shell replaces `admin-workspace.vue`, and each screen becomes a page contributed through `couchdb.admin.sections`.
