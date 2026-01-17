## Initial Prompt
For the update_seq value, only keep the first numeric part, so for 835-g1AAAACheJzLYWBgYMpgTmEQTM4vTc5ISXIwNDLXMwBCwxyQVB4LkGRoAFL_gSArgzmJgYFxTS5QjN3Y0iQ11dwCm1Y8BiYyJNUjTJoONinVMNXE0jQFm54sAMqnKac store as 835. Make the spinner page-wide and update all table elements at once at the end.

## Implementation Summary
Implementation Summary: Normalized update_seq to show only the leading numeric segment and switched detail loading to a page-wide spinner so table cells update together after all db-info requests complete.

## Documentation Overview
- Data Sync now aggregates db-info responses before updating the table, showing a single loading row while details load.
- update_seq displays only the initial numeric portion, preserving the full value in the title attribute.

## Implementation Examples
```ts
const getUpdateSeqNumber = (value?: string) => value?.match(/^\d+/)?.[0] ?? null
```
