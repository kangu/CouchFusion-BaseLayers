# JSON Array Support

- [x] Refactor the Vue code processing to allow for type `"jsonarray"` elements. Take this example from the `BulletsSection.vue` component:

```
props: {
  ...,
  cards: {
    type: Array,
    required: true,
    validator: (value: Array<any>) => value.every(card =>
      card.title && card.description && (card.icon || card.icon === '')
    )
  }
}
```

- [x] From the validator function, infer the structure of the data and output the field names and their types in the `component-definitions.ts` file so that they can be consumed by `NodeEditor.vue` and `Workbench.vue` to allow editing the array entries.
