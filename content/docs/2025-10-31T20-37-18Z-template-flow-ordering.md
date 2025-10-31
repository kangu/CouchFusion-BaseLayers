## Template-Derived Prop & Slot Ordering

- The registry generator now parses component templates with `@vue/compiler-dom` to determine the order in which props and slots appear.
- Output schema keeps that sequence via a new `flow` array on each `ComponentDefinition`, mixing `prop` and `slot` entries so editors can reflect template flow.
- Slot metadata is emitted as `definition.slots` (default plus named slots in encounter order) and `allowChildren`/`childHint` reuse this data.
- Props tied to the new `TextAreaString` alias continue to surface as `type: 'textarea'` in the schema, ensuring the node editor renders a multiline control.

### Flow Object Shape
```ts
flow: [
  { type: 'prop', key: 'title' },
  { type: 'slot', name: 'default' },
  { type: 'prop', key: 'quickStartCommand' }
]
```

Use this ordering metadata in the builder UI to present props and slots exactly as they appear in the component markup.
