# Workbench Condensed Fullwidth

## Initial Prompt
```
The .content-admin-workbench__editor-body should change its grid settings to better accomodate the case < 1000px on the container queries. Its childs should have 100% of its width, then .content-admin-workbench__editor-canvas should also have 100% and properly include the .editor-canvas__workbench element. Render the http://localhost:3011/builder using the MCP playwrgiht server, check visually and inside the code if everything works correctly.
```

## Implementation Summary
Expanded the condensed container-query styles so the editor body and canvas span the full width under 1000 px, giving every child (including the workbench) 100% width for small layouts.

## Documentation Overview
- `@container workbench` block now sets `grid-auto-rows`, forces `width: 100%` on child panels, and stretches the builder canvas so the inline editor fills the available space.
- Attempted to verify via the MCP Playwright server (`http://localhost:3011/builder`), but the route returned the expected auth-guarded response (404/401) without credentials; layout will need manual validation once logged in.

## Implementation Examples
```css
@container workbench (max-width: 999px) {
  .content-admin-workbench__editor-body {
    grid-template-columns: 1fr;
    grid-auto-rows: auto;
  }

  .content-admin-workbench__editor-body > * {
    width: 100%;
  }

  .content-admin-workbench__editor-canvas {
    width: 100%;
  }
}
```
