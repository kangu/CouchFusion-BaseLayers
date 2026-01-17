## Initial Prompt
When a replication job is in progress, use a slight different background color of the table row. Avoid redraws by showing/hiding elements that cause rerender

## Implementation Summary
Implementation Summary: Highlighted rows during active replication and switched status message blocks to v-show to reduce DOM churn.

## Documentation Overview
- Replication rows now get a subtle background tint and status messages toggle via v-show.

## Implementation Examples
```vue
<tr :class="{ 'bg-orange-50/60': isReplicationActive(replicationStatusMap[db]) }">
```
