<script setup lang="ts">
import { useContentPropId } from '#content/app/composables/useContentPropId'

/** A developer-authored section that can be selected in an inline preview. */
export interface LivePreviewSection {
  id: string
  label: string
}

// props
const props = defineProps<{
  sections: LivePreviewSection[]
  activeSection: string
  visible?: boolean
}>()

// composables
const { isInlinePreview } = useContentPropId()

// local page api
/** Emits the selected developer-defined preview section id. */
const emit = defineEmits<{
  select: [sectionId: string]
}>()
</script>

<template>
  <nav
    v-if="props.visible || isInlinePreview"
    class="mb-4 rounded-lg border border-dashed border-gray-300 bg-white p-3 text-sm"
    aria-label="Preview sections"
  >
    <div class="flex flex-wrap items-center gap-2" role="tablist" aria-label="Component sections">
      <span class="mr-1 font-medium text-gray-700">Preview section:</span>
      <button
        v-for="section in props.sections"
        :id="`${section.id}-tab`"
        :key="section.id"
        type="button"
        role="tab"
        :aria-controls="section.id"
        :aria-selected="section.id === props.activeSection"
        :class="section.id === props.activeSection ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'"
        class="rounded px-2 py-1"
        data-inline-preview-interactive="true"
        @click="emit('select', section.id)"
      >
        {{ section.label }}
      </button>
    </div>
  </nav>
</template>
