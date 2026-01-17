## Initial Prompt
When the host and credetials are set, run the refresh call onMounted

## Implementation Summary
Implementation Summary: Triggered the Data Sync refresh automatically on mount when stored credentials are present.

## Documentation Overview
- The Data Sync page now auto-fetches databases on first load when the host/credentials are already configured.

## Implementation Examples
```ts
onMounted(() => {
  isClient.value = true
  if (hasCredentials.value) {
    fetchDatabases()
  }
})
```
