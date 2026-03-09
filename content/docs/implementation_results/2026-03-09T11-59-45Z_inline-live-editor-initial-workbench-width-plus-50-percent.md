# Initial Prompt
I want to update so the initial width of the workbench panel Next to the iframe live editor is fifty percent wider than it is now.

# Plan
1. Locate the default sidebar/workbench width source in the inline live editor split layout.
2. Increase the default value by 50%.
3. Keep drag/resizing and constraints unchanged for minimal behavioral impact.

# Implementation Summary
- Updated shared content layer component:
  - `layers/content/app/components/inline/InlineLiveEditor.vue`
- Changed default sidebar width from `420px` to `630px` (+50%) in both places that define initial value:
  1. Script state default:
     - `const sidebarWidth = ref(630);`
  2. CSS variable fallback:
     - `--inline-sidebar-width: 630px;`
- No other resizing logic was modified (`MIN/MAX`, drag, storage behavior unchanged).

# Proposed Next Steps
1. Open the inline editor and confirm the initial desktop split shows a wider workbench panel.
2. If you want this to override previously persisted user width too, we can add a one-time localStorage migration/reset.
