# Initial Prompt
I get this error: [Vue warn]: Property "objectField" was accessed during render but is not defined on instance. 
  at <NodeEditor node= . Also investigate how the export const builderFieldMeta = {
  'sections.questions.scale': { visibleWhen: { prop: 'type', equals: 'scale' } },
  'sections.questions.allowOther': { visibleWhen: { prop: 'type', equals: 'checkbox' } },
  'sections.questions.otherLabel': { visibleWhen: { prop: 'type', equals: 'checkbox' } },
  'sections.questions.otherPlaceholder': { visibleWhen: { prop: 'type', equals: 'checkbox' } }
} mentions that the "type" has to be on the "question", not on the top object.

# Implementation Summary
Updated NodeEditor to filter fields via `filterVisibleFields` instead of v-if inside v-for across all nesting levels (props, object fields, array items, nested arrays/objects), eliminating the `objectField` undefined warning and ensuring visibleWhen evaluates against the correct context (e.g., per-question `type`) so checkbox/scale-only controls stay hidden for paragraph questions.

# Documentation Overview
- Added `filterVisibleFields` helper and applied it wherever fields render, avoiding v-if-in-v-for scope issues.  
- VisibleWhen rules now rely on the current item context, so question-level `type` drives checkbox/scale field visibility correctly.

# Implementation Examples
- For a paragraph question, “Allow Other” and scale fields no longer render.  
- For a checkbox question, Other controls appear; for a scale question, only scale config shows.  
- No Vue warnings about `objectField` after the change.
