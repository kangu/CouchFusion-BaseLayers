# Initial Prompt
The SurveyComponentQuestionProp has the type prop which is type?: 'text' | 'paragraph' | 'multiple-choice' | 'checkbox' | 'scale'. How can we update the generate-component-registry.mjs script and the NodeEditor component to render a dropdown component from which you can choose only one of those values?

# Implementation Summary
Registry generator now applies `type`, `options`, and `default` from component-exported metadata, enabling select controls without hard-coding. SurveyForm exports type options, so the builder renders a dropdown constrained to the allowed question types.

# Documentation Overview
- Generator merges `options`, `type`, and `default` from `builderFieldMeta` paths into the schema.  
- SurveyForm’s `type` field is now a select with fixed options; NodeEditor renders it automatically via the updated schema.

# Implementation Examples
- In component metadata:  
  ```ts
  export const builderFieldMeta = {
    'sections.questions.type': {
      type: 'select',
      options: [
        { label: 'Text', value: 'text' },
        { label: 'Paragraph', value: 'paragraph' },
        { label: 'Multiple Choice', value: 'multiple-choice' },
        { label: 'Checkbox', value: 'checkbox' },
        { label: 'Scale', value: 'scale' }
      ]
    }
  }
  ```  
  After regeneration, the editor shows a dropdown limited to these values.
