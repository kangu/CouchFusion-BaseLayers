The NodeEditor.vue component should work on the 2nd and 3d nesting level as it does on the first one,
with rendering list elements (Expand/Collapse buton + add new) for props of type "stringarray".

## Checklist

- [x] Ensure **2nd-level** `stringarray` fields render the full list UI (collapse toggle, add/remove, drag) instead of a plain text box.
- [x] Ensure **3rd-level** `stringarray` fields inherit the same UI/behavior even when nested inside another `jsonarray` item (e.g., sections → questions → options).

Here is a sample config:
{
  id: 'survey-form',
  label: 'Survey Form',
  description: 'Auto-generated registry entry for SurveyForm.',
  props: [
    {
      key: 'meta',
      label: 'Meta',
      type: 'jsonobject',
      fields: [
        {
          key: 'collectsEmail',
          label: 'Collects Email',
          type: 'boolean',
          default: undefined
        },
        {
          key: 'description',
          label: 'Description',
          type: 'text'
        },
        {
          key: 'id',
          label: 'Id',
          type: 'text'
        },
        {
          key: 'isQuiz',
          label: 'Is Quiz',
          type: 'boolean',
          default: undefined
        },
        {
          key: 'shuffleQuestions',
          label: 'Shuffle Questions',
          type: 'boolean',
          default: undefined
        },
        {
          key: 'title',
          label: 'Title',
          type: 'text'
        }
      ]
    },
    {
      key: 'accentColor',
      label: 'Accent Color',
      type: 'text',
      default: '#F97316'
    },
    {
      key: 'apiEndpoint',
      label: 'Api Endpoint',
      type: 'text',
      default: '/api/survey'
    },
    {
      key: 'sections',
      label: 'Sections',
      type: 'jsonarray',
      items: [
        {
          key: 'description',
          label: 'Description',
          type: 'text'
        },
        {
          key: 'id',
          label: 'Id',
          type: 'text'
        },
        {
          key: 'questions',
          label: 'Questions',
          type: 'jsonarray',
          items: [
            {
              key: 'id',
              label: 'Id',
              type: 'text'
            },
            {
              key: 'title',
              label: 'Title',
              type: 'text'
            },
            {
              key: 'description',
              label: 'Description',
              type: 'text'
            },
            {
              key: 'type',
              label: 'Type',
              type: 'text'
            },
            {
              key: 'required',
              label: 'Required',
              type: 'boolean',
              default: undefined
            },
            {
              key: 'options',
              label: 'Options',
              type: 'stringarray',
              default: undefined
            },
            {
              key: 'scale',
              label: 'Scale',
              type: 'text'
            }
          ],
          default: undefined
        },
        {
          key: 'title',
          label: 'Title',
          type: 'text'
        }
      ]
    },
    {
      key: 'startLabel',
      label: 'Start Label',
      type: 'text',
      default: 'Begin the survey'
    },
    {
      key: 'submitLabel',
      label: 'Submit Label',
      type: 'text',
      default: 'Submit responses'
    }
  ],
  flow: [
    {
      type: 'prop',
      key: 'meta'
    },
    {
      type: 'prop',
      key: 'accentColor'
    }
  ]
}

The "options" property is an array of strings that represent the possible answers for a question. At the moment
the elemnt is rendered in the UI as a text field. I want to update that so it correctly renders with the list
elements (like its parents "sections" and "questions").
