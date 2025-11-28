<script setup lang="ts">
import { computed, onErrorCaptured, ref, watch } from 'vue'

interface Props {
  /** A stable key (e.g. route path) used to reset captured errors when navigating. */
  context?: string
}

const props = withDefaults(defineProps<Props>(), {
  context: 'content',
})

const isDev = process.dev
const capturedError = ref<Error | null>(null)
const capturedInfo = ref<string | null>(null)

const reset = () => {
  capturedError.value = null
  capturedInfo.value = null
}

watch(
  () => props.context,
  () => {
    reset()
  },
)

if (isDev) {
  onErrorCaptured((err, _instance, info) => {
    const normalizedError = err instanceof Error ? err : new Error(String(err))
    capturedError.value = normalizedError
    capturedInfo.value = info ?? null
    console.error('[content-dev-error-boundary]', normalizedError, info)
    // Prevent the error from bubbling to Nuxt error page while in dev.
    return false
  })
}

const errorMessage = computed(() => capturedError.value?.message || 'Unknown error')
const errorStack = computed(() => capturedError.value?.stack || capturedError.value?.toString() || null)
</script>

<template>
  <slot v-if="!isDev || !capturedError" />
  <div v-else class="rounded border border-red-200 bg-red-50 text-red-900 p-4 space-y-2">
    <div class="font-semibold">Content render error (dev only)</div>
    <p class="text-sm">{{ errorMessage }}</p>
    <p v-if="capturedInfo" class="text-xs text-red-700">{{ capturedInfo }}</p>
    <pre v-if="errorStack" class="text-xs bg-white/70 border border-red-100 p-2 rounded overflow-auto max-h-48">{{ errorStack }}</pre>
    <button type="button" class="text-xs underline" @click="reset">Clear and retry</button>
  </div>
</template>
