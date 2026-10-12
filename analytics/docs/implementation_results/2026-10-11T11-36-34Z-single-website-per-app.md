# Single website per app

## Initial prompt
"Each website would handle its own analytics module, so there's no point that in the Websites section to be a + Add website. Make it all about the settings of the current website. There is to be no data-website-id needed from the frontend as all input would go to a single website."

## Plan followed
1. Engine: `defaultSiteId` falls back to the app slug; `ensureAppSite()` auto-creates the website record (any hostname, `/admin*` + `/login` excluded, server timezone); the collector ignores `payload.website`.
2. API: `sites/:id/...` → `site/...` on admin and share; website list/create/delete removed; v1 lost its site segment (`/v1/site`, `/v1/stats`, `/v1/metrics/:dim`, `/v1/realtime`, `/v1/sessions`, `/v1/reports/:type`); API keys no longer carry a site scope.
3. Tracker: `/a.js` no longer reads `data-website-id`.
4. UI: Websites page replaced by Settings (`/admin/analytics/settings`): website settings, tracking, share link, engine settings, data. Site picker removed from the toolbar; "no websites" state removed.
5. Docs: README.md, README.html, `docs/self-hosted-analytics.md`, `agents.md`, spec note.

## Summary
- Tests: 37 pass (unit plus CouchDB integration, including auto-creation of the website).
- Verified on a temporary kangu instance:
  - old multi-site routes return 404
  - a hit carrying a bogus `website` lands on the one site
  - v1 paths respond
  - the Settings page renders and the sidebar shows "Settings"
- Breaking for anything that used the old paths: `/admin/analytics/websites`, `/api/analytics/admin/sites/**`, `/api/analytics/v1/sites/**`. Nothing outside the layer used them.

## Next steps
- Restart any running dev server (the page rename is registered at startup).
