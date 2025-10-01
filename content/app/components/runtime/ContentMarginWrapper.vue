<template>
  <div :class="className">
    <slot />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ class?: string }>()

const className = computed(() => props.class || '')
</script>
