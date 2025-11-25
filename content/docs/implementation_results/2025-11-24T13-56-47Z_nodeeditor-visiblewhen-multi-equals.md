# Initial Prompt
I have added this `'sections.questions.allowOther': { visibleWhen: { prop: 'type', equals: ['checkbox', 'multiple-choice'] } },` to the builderFieldMeta on SurveyForm, but I don't see the field at all now. How can I make it show up on either "checkbox" or "multiple-choice"?

# Implementation Summary
Updated NodeEditor `visibleWhen` evaluation to support array-valued `equals`, treating it as an OR list. Now fields with `equals: ['checkbox', 'multiple-choice']` render when the context value matches any entry, so “Allow Other” appears for both checkbox and multiple-choice questions.

# Documentation Overview
- `visibleWhen.equals` can be a single value or an array; arrays are treated as OR matches against the current context value.  
- No generator changes needed; metadata with an array `equals` now works at runtime.

# Implementation Examples
- In `builderFieldMeta`: `visibleWhen: { prop: 'type', equals: ['checkbox', 'multiple-choice'] }` now shows the field for both types.  
- Single-value rules continue to work unchanged.
