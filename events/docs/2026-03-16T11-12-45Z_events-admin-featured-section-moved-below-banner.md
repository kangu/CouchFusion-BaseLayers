# Initial Prompt
Move the Featured Conferences section just below the Events Operations top banner panel

# Plan
1. Reposition the existing Featured Conferences section in the admin conferences page template.
2. Keep section content and behavior unchanged.
3. Avoid touching API/state logic.

# Implementation Summary
- Updated `layers/events/app/pages/admin/events/conferences.vue` to move the entire `Featured Conferences` section directly below the top `Events Operations` banner panel.
- No logic changes were made to featured management (add/remove/toggle/reorder/upload/save).
- No API or data-model changes were made.

# Next Steps
1. Reload `/admin/events/conferences` and verify Featured Conferences now appears immediately under the top banner.
