# Live Preview Debounce

## Initial Prompt
```
For the content module while editing, make sure that live preview is sent to a listening iframe on all types of edits; currently it's working on regular text fields, make it work on @input with slight debounce for: items inside jsonarray elements, items inside jsonobject elements, image selection
```

## Plan
1. Review current live preview handling and identify missing debounce for jsonarray/jsonobject/image components.  
2. Implement debounced updates for complex fields and custom pickers to trigger iframe live preview.  
3. Document changes and verification notes.

## Implementation Summary
Extended the builder node editor so json/object-based controls emit debounced updates via `commitPropChange`, ensuring the inline iframe receives live preview messages when editing array/object fields or selecting images.

## Next Steps
1. Smoke-test editing nested arrays/objects plus image pickers in `/builder` to confirm the iframe refreshes while typing.  
2. Consider exposing the debounce delay via config if future projects need faster/slower previews.
