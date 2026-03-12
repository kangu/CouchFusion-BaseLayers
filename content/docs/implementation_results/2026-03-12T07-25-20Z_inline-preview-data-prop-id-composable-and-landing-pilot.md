# Inline Preview `data-prop-id` Markers: Shared Composable + Landing Pilot

## Goal
Enable optional `data-prop-id` markers on rendered prop output so inline live editor can map clicked DOM elements back to component props.

## Implemented

### 1) Shared content-layer composable
Added:
- `layers/content/app/composables/useContentPropId.ts`

Behavior:
- Detects inline preview mode using route query key `inline-preview`.
- Exposes `resolveContentPropId(propPath)`.
- Returns:
  - dotted prop path (e.g. `primaryButton.label`) in inline preview mode
  - `null` outside inline preview mode (attribute omitted in normal/prod routes)

### 2) Pilot wiring in `Landing.vue` (radustanciu app)
Updated:
- `apps/radustanciu/app/components/content/Landing.vue`

Added `:data-prop-id="resolveContentPropId('...')"` to prop-rendering tags for:
- `headlinePrefix`
- `greetingText`
- `primaryButton.href`
- `primaryButton.label`
- `languagePanelTitle`
- `profileImage`
- `profileAltText`

## Notes
- This is a pilot implementation on one component.
- Pattern is ready to be rolled out to other content components with dotted-path mapping.
