# Admin Workspace Theme Hook Contract

## Summary
Added stable class hooks and optional `themeClass` support so consuming apps can theme admin workspace without modifying shared layout behavior.

## Shared Hooks Added
- Layout: `aw-shell`, `aw-main`, `aw-header`, `aw-content`, `aw-content-container`
- Sidebar: `aw-sidebar`, `aw-sidebar-surface`, `aw-sidebar-brand`, `aw-sidebar-nav`, `aw-sidebar-footer`
- Navigation: `aw-nav`, `aw-nav-section`, `aw-nav-section-title`, `aw-nav-link`, `aw-nav-link-active`, `aw-nav-icon`
- Mobile: `aw-mobile-overlay`, `aw-mobile-backdrop`, `aw-mobile-panel`, `aw-mobile-nav`, `aw-mobile-footer`
- Profile: `aw-header-profile-trigger`, `aw-header-profile-menu`

## Config Contract
`appConfig.adminWorkspace.themeClass` can be set by consuming apps.
- Default behavior remains unchanged when unset.
- Enables app-scoped selectors such as `.my-theme.aw-shell ...`.
