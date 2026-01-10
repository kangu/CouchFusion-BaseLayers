Inside the /builder page, for the NodeEditor and Workbench components, plan a refactor for the current "Select component" dropdown.

The dropdown should be replaced with a modal popover dialog that allows the user to see all available components. The dialog should have a search bar to filter the components by name.

Next to the component name, there should be a live rendering of the Vue component in a "mini state" component, so that the user can see what the component looks like.

The "mini" view should contain both a mobile-size and desktop-size rendering of the component, done with zoom scaling or any other method that is relevant and useful.

The goal of the feature is to make it easier for the user to find the component they want to add to the page, by seeing it render with its default props.