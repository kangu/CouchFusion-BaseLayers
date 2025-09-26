Add a feature to the builder that allows it to be initialized through a prop which defines its
initial configuration state. The prop will be cloned locally for working with "draft" data, and
can be swapped entirely if needed. Add a "Load Debug Data" import button that reads a json
file uploaded to the browser and initializes the builder config based on that. Future implementation
will also cover loading data into the component through a REST API

_Status (2025-09-25): ✅ `BuilderWorkbench` accepts an `initialDocument`, clones it for local edits, and includes a "Load Debug Data" JSON importer._

When the builder is initialized with page data, all sections are to be updated, including the
complete render of the nodes section. Practically the user should be able to seamlessly continue
updating a previously saved json data file.

_Status (2025-09-25): ✅ Import hydrates page config, layout, and the full node tree so editing can resume immediately._

Run on-the-fly Playwright tests with dummy data to make sure the config is loaded correctly 
throughout the interface.

_Status (2025-09-25): ✅ Playwright covers debug import, asserting fields, spacing, serialized output, and rendered nodes._
