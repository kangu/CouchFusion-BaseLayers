# Initial Prompt
I have a question of type "paragraph" and I still see "Allow Other" option in the Node editor UI. Investigate and propose a fix

# Implementation Summary
Implemented runtime support for `visibleWhen` metadata in the builder NodeEditor so fields render only when their conditions match the current draft context (OR-able rules). Survey question checkbox fields now hide “Allow Other”/labels/placeholders when the question type is not `checkbox`, eliminating the paragraph-type UI leak without hard-coding component logic.

# Documentation Overview
- Added a generic `isFieldVisible` helper that evaluates `visibleWhen` rules (single or array) against the current draft context at each nesting level (props, jsonobject fields, jsonarray items, nested arrays/objects).  
- Applied visibility checks across NodeEditor rendering, so schema-provided rules govern UI display without component-specific branches.  
- This leverages generated schema metadata (e.g., SurveyForm’s checkbox/scale conditions) while keeping NodeEditor generic.

# Implementation Examples
- For a SurveyForm question with `type: 'paragraph'`, the builder now hides `allowOther` and related fields automatically.  
- For `type: 'checkbox'`, the “Allow Other” toggle and label/placeholder fields appear; switching the type to “scale” hides them and shows the scale config instead.  
- Any component that exports visibility rules via the registry schema will see NodeEditor enforce them without additional code changes.
