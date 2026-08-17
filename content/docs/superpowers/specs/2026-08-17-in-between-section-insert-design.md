# In-between section insertion design

## Goal

Avoid the redundant placement dialog when an editor chooses a component from an in-between section control, because that control already identifies the insertion index.

## Behavior

- The position-neutral `+ Section` control keeps the existing component picker, section-name prompt, and `SectionPlacementDialog` flow.
- An in-between control keeps the component picker and section-name prompt, then inserts at its stored `pendingRootInsertIndex` immediately.
- Cancellation clears pending picker, name, and insertion state in both flows.

## Verification

Add a focused Workbench test that proves an indexed insertion invokes the existing insertion handler directly and does not open `SectionPlacementDialog`; a null index opens the dialog.
