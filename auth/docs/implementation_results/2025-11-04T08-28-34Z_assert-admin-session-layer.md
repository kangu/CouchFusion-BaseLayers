# Initial Prompt
Investigate how to include this as a server route in the analytics plugin so the caddy configuration is not needed anymore. The https://cloud.umami.is value should be exposed as a runtime property -- follow-up request to refactor admin session helper.

# Plan
1. Move the existing app-level `assertAdminSession` helper into the auth layer.
2. Update app imports to use the shared helper.
3. Document the change.

# Implementation Summary
Centralised the admin session assertion helper inside the auth layer so all apps can reuse the same logic when guarding server routes.

# Next Steps
- Update other apps to import the shared helper and delete any local duplicates.
