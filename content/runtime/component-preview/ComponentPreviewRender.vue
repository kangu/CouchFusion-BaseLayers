<script setup lang="ts">
import { computed } from "vue";
import { declaredPreviewDefaults } from "#content/app/utils/component-preview";

definePageMeta({ layout: false });

const route = useRoute();
const { registry } = useComponentRegistry();
const componentId = computed(() => String(route.params.componentId || ""));
const definition = computed(() => registry.lookup[componentId.value]);
const renderComponentId = computed(
  () =>
    definition.value?.previewComponentId?.trim() || definition.value?.id || "",
);
const renderProps = computed(() =>
  definition.value ? declaredPreviewDefaults(definition.value) : {},
);
</script>

<template>
  <main class="component-preview-render">
    <div v-if="!definition" class="component-preview-message" role="status">
      Component "{{ componentId }}" is not registered.
    </div>
    <NuxtErrorBoundary v-else>
      <component :is="renderComponentId" v-bind="renderProps" />
      <template #error="{ error, clearError }">
        <section class="component-preview-message" role="alert">
          <h1>Component could not be rendered</h1>
          <p>{{ componentId }}</p>
          <p>{{ error?.message || "The preview encountered an error." }}</p>
          <button type="button" @click="clearError">Try again</button>
        </section>
      </template>
    </NuxtErrorBoundary>
  </main>
</template>

<style scoped>
:global(html),
:global(body),
:global(#__nuxt) {
  width: 100%;
  min-height: 100%;
  margin: 0;
}

.component-preview-render {
  width: 100%;
  min-height: 100vh;
  overflow-x: hidden;
}

.component-preview-message {
  box-sizing: border-box;
  max-width: 36rem;
  margin: 3rem auto;
  padding: 1rem;
  border: 1px solid #d1d5db;
  background: #fff;
  color: #111827;
  font: 0.9rem/1.5 system-ui, sans-serif;
}

.component-preview-message h1,
.component-preview-message p {
  margin: 0 0 0.5rem;
}
</style>
