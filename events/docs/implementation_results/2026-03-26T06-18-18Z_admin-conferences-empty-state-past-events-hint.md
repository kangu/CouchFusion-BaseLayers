# Initial Prompt
There could be a case where I select a year in the past but the past events checkbox is not on. When this scenario happens and you see there are some past events that match that year, which they should because otherwise the year wouldn't be there, make a visible note in the No Conferences Found section to mention that past events need to be enabled in order to see something.

## Plan
1. Detect when current API-filtered conferences exist but all are hidden by the local `Past events` toggle.
2. Keep existing empty state text and add a visible contextual hint only for this case.
3. Scope changes to admin conferences page only.

## Implementation Summary
- Updated `layers/events/app/pages/admin/events/conferences.vue`:
  - Added computed `hasPastOnlyMatchesHidden`:
    - true when `showPastEvents` is off,
    - API-filtered `conferences` has results,
    - all those results are past conferences.
  - In the `No conferences found` empty state, added an amber helper note shown only when `hasPastOnlyMatchesHidden` is true:
    - “Matching conferences are in the past. Enable Past events to view them.”

## Next Steps
1. If you want, I can add a one-click inline action in that note to toggle `Past events` on directly.
