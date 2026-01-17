## Initial Prompt
I get a hydration error on the button for Fetch Databases and it's disabled

## Implementation Summary
Implementation Summary: Guarded the Data Sync form readiness behind a client-only flag so localStorage-backed credentials no longer cause SSR hydration mismatches on the Fetch Databases button.

## Documentation Overview
- The button now remains disabled until `onMounted` sets a client flag, preventing SSR/client state divergence from localStorage values.

## Implementation Examples
```ts
const isClient = ref(false)

onMounted(() => {
  isClient.value = true
})

const isReady = computed(() => isClient.value && Boolean(host) && Boolean(username) && Boolean(password))
```
