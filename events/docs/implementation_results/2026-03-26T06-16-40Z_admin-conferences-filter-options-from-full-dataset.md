# Initial Prompt
When I filter by a certain year, the other values in the filter dropdown disappear, looks like the source of the dropdown list comes from the filtered events. Make it so that the source of the dropdown is always from the entire dataset

## Plan
1. Update admin conferences API response metadata so filter option lists are generated from the full conferences dataset.
2. Keep list filtering behavior unchanged; only change metadata source for dropdown options.
3. Persist a short implementation note in the events layer docs.

## Implementation Summary
- Updated `layers/events/server/api/events/conferences/index.get.ts`:
  - `yearOptions` is now computed from `normalizedBaseConferences` (full dataset), not from currently filtered `conferences`.
  - `continentOptions` is now computed from `normalizedBaseConferences` (full dataset), not from `allConferences`.
- Result:
  - Selecting a year no longer collapses/removes other year options in the dropdown.
  - Continent options also stay stable and sourced from the full dataset.

## Next Steps
1. If you want similar stable option-source behavior on public pages too, we can mirror this strategy in the public conferences endpoint metadata.
