<script setup lang="ts">
/**
 * ToastFallback - Fallback toast notification component
 * Used when consuming app doesn't provide its own useToast composable
 */

const props = defineProps<{
  visible: boolean
  message: string
  variant?: 'success' | 'error' | 'info'
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const variantClasses = computed(() => {
  switch (props.variant) {
    case 'error':
      return 'bg-red-50 border-red-200 text-red-800'
    case 'info':
      return 'bg-blue-50 border-blue-200 text-blue-800'
    case 'success':
    default:
      return 'bg-green-50 border-green-200 text-green-800'
  }
})

const iconName = computed(() => {
  switch (props.variant) {
    case 'error':
      return 'mdi:alert-circle'
    case 'info':
      return 'mdi:information'
    case 'success':
    default:
      return 'mdi:check-circle'
  }
})
</script>

<template>
  <Transition
    enter-active-class="transition duration-300 ease-out"
    enter-from-class="translate-y-2 opacity-0"
    enter-to-class="translate-y-0 opacity-100"
    leave-active-class="transition duration-200 ease-in"
    leave-from-class="translate-y-0 opacity-100"
    leave-to-class="translate-y-2 opacity-0"
  >
    <div
      v-if="visible"
      class="fixed bottom-4 right-4 z-50 max-w-sm rounded-lg border p-4 shadow-lg"
      :class="variantClasses"
      role="alert"
    >
      <div class="flex items-start gap-3">
        <Icon :name="iconName" class="h-5 w-5 flex-shrink-0 mt-0.5" />
        <div class="flex-1">
          <p class="text-sm font-medium">{{ message }}</p>
        </div>
        <button
          type="button"
          class="flex-shrink-0 rounded p-1 hover:bg-black/5 focus:outline-none focus:ring-2 focus:ring-offset-1"
          :class="`focus:ring-${variant === 'error' ? 'red' : variant === 'info' ? 'blue' : 'green'}-500`"
          @click="emit('close')"
        >
          <Icon name="mdi:close" class="h-4 w-4" />
        </button>
      </div>
    </div>
  </Transition>
</template>
