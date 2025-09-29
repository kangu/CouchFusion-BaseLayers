Refactor the vue code processing to allow for type: "jsonarray"
elements. Take this example from the BulletsSection.vue component:

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

From the validator function you can infer the structure of the data. Output the field names and their types and the component-definition.ts file so that they can be later read by
the content layer NodeEditor.vue and Workbench.vue components
to allow changing the data structure.
