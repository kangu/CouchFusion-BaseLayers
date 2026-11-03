# Initial Prompt
Upcoming only checkbox no longer reveals past events when unticked.

# Plan Followed
Trace board fetch/local filters and public conferences API month cutoff. Add opt-in history to API and request it for the board; regenerate registry and syntax-check.

# Proposed Next Steps
Deploy both app and shared events-layer changes. Untick Upcoming only in either list/calendar view to show published past conferences (subject to other active filters). Existing other API consumers retain current/future-month default.

# Implementation Summary
Root cause: /api/events/public/conferences always removed earlier months before frontend filtering. Added includePast=true (also accepts1) opt-in to published-conference date filter. ConferenceBoard requests history once and existing local upcoming checkbox controls past visibility immediately. Only published conferences with valid start dates qualify as before. Default API date range remains unchanged. Year/location options now include available history on board. No live data mutations performed.

# Validation
Registry generation succeeded. ConferenceBoard Vue template and events API TypeScript syntax checks passed. No tests, browser interaction, lint or build run.
