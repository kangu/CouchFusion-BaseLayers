# Initial Prompt
Add a "Strong Text" inline component globally to useComponentRegistry.ts

# Implementation Summary
Registered a default `strong` component in the shared content builder registry so editors can wrap text in bold without custom per-app definitions.

# Documentation Overview
- The default component registry now exposes a “Strong Text” inline item that renders as a native `<strong>` tag when serialized.
- Because it ships from the content layer’s registry, every app using the layer automatically inherits the new inline option.
- The definition allows child nodes, so editors can nest plain text or other inline components inside the bold wrapper.

# Implementation Examples
- `layers/content/app/composables/useComponentRegistry.ts:24` – inserts the new `strong` component with descriptive metadata and child guidance.
