# Initial Prompt
I get this error: runtime-core.esm-bundler.js?v=9c27ae4b:50 [Vue warn]: Invalid prop: type check failed for prop "jsonValue". Expected String with value "[object Object]", got Object

# Implementation Summary
Updated NodePropsPanel to pass a formatted JSON string into NodeObjectField so jsonValue is always a string.

# Documentation Overview
- NodeObjectField now receives `jsonValue` via `formatJsonValue` instead of raw object values.

# Implementation Examples
- `:json-value="formatJsonValue(propDraft[prop.key])"`
