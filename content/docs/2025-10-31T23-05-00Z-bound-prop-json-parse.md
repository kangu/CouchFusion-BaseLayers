# Bound Prop JSON Parsing

## Initial Prompt
```
In the content layer through the <Content> component, Whenever a component prop is passed through the AST in the form of a stringified object (key starting with :), whenever is passed to the implementing app, it should transform the prop name to be without the starting : and the value would set it as the json.parse() value of the initial value
```

## Implementation Summary
Updated the content runtime renderer so colon-prefixed props (e.g. `":config":"{\"foo\":1}"`) are mapped to plain prop names and JSON-parsed before being handed to downstream components.

## Documentation Overview
- `normalizeProps` now strips `:` prefixes, parses string values with `JSON.parse`, and warns when parsing fails while falling back to the original string.
- Parsed entries merge back into the prop object after legacy class/style normalisation, preserving defaults and ensuring bindings behave identically across server and client renders.
- Any builder-generated AST that encodes objects as strings can now hydrate properly without extra coercion in implementing apps.

## Implementation Examples
```ts
if (key.startsWith(':') && key.length > 1) {
  const targetKey = key.slice(1)
  const value = props[key]

  if (typeof value === 'string') {
    try {
      boundEntries[targetKey] = JSON.parse(value)
    } catch (error) {
      console.warn('[content-layer] Failed to parse bound prop JSON:', targetKey, error)
      boundEntries[targetKey] = value
    }
  } else {
    boundEntries[targetKey] = value
  }

  delete props[key]
}
```

```ts
if (Object.keys(boundEntries).length > 0) {
  Object.assign(props, boundEntries)
}
```
