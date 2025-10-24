Extend the content layer to expose an API endpoint at /api/sitemap.xml containing a valid XML sitemap.

Progress:
- [x] Valid `/pages` routes from the implementing app are scanned and persisted on build/watch hooks.
- [x] Pages registered in the content CouchDB database are included via the `content/by_path` view.
- [x] Optional additional routes from the implementing app `app.config.ts` content section are merged into the sitemap output.
