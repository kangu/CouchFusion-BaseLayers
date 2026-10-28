<script setup lang="ts">
import {
  useCouchDBColorScheme,
  type CouchDBColorScheme,
} from './useCouchDBColorScheme'
const { scheme, setScheme } = useCouchDBColorScheme()
const options: { value: CouchDBColorScheme; label: string; path: string }[] = [
  {
    value: 'system',
    label: 'Match system',
    path: '<rect x="2" y="3" width="12" height="8.5" rx="1.2"/><path d="M5.5 14h5M8 11.5V14"/>',
  },
  {
    value: 'light',
    label: 'Light',
    path: '<circle cx="8" cy="8" r="2.8"/><path d="M8 1.5v1.6M8 12.9v1.6M1.5 8h1.6M12.9 8h1.6M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M3.4 12.6l1.1-1.1M11.5 4.5l1.1-1.1"/>',
  },
  {
    value: 'dark',
    label: 'Dark',
    path: '<path d="M13 9.6A5.5 5.5 0 0 1 6.4 3 5.5 5.5 0 1 0 13 9.6z"/>',
  },
]
</script>
<template>
  <div class="cf-scheme" role="group" aria-label="Colour scheme">
    <button
      v-for="o in options"
      :key="o.value"
      type="button"
      :aria-pressed="scheme === o.value"
      :aria-label="o.label"
      :title="o.label"
      @click="setScheme(o.value)"
    >
      <svg
        class="cf-ic"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
        v-html="o.path"
      />
    </button>
  </div>
</template>
