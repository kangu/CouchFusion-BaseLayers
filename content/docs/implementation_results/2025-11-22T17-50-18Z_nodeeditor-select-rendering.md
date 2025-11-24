# Initial Prompt
Make sure the NodeEditor component can render the type="select" field

# Implementation Summary
NodeEditor now renders select inputs for schema fields marked as `type: 'select'` in both array items and nested array items. Combined with generator metadata merge and SurveyForm’s type options, the question type control now shows as a dropdown with constrained values.

# Documentation Overview
- Added select handling branches in NodeEditor for array and nested array fields.  
- Schema continues to come from generator metadata (`options` + `type`), keeping the editor generic.

# Implementation Examples
- Survey question `type` shows as a select with the five allowed options; nested select fields will render similarly wherever schema specifies `type: 'select'`.
