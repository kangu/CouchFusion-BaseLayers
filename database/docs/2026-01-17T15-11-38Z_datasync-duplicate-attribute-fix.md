## Initial Prompt
I get this error [plugin:vite:vue] Duplicate attribute.
/Users/radu/Projects/nuxt-apps/layers/database/pages/admin/datasync.vue:425:21

## Implementation Summary
Implementation Summary: Removed duplicate class attributes from Data Sync table spans to resolve the Vite Vue compiler error.

## Documentation Overview
- Consolidated repeated class attributes into a single class declaration.

## Implementation Examples
```vue
<span class="block font-semibold text-gray-900">...</span>
```
