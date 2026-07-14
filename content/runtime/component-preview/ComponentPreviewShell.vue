<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import PreviewDeviceToggle from "#content/app/components/builder/PreviewDeviceToggle.vue";
import {
  MOBILE_PREVIEW_WIDTH,
  type PreviewDevice,
} from "#content/app/utils/component-preview";

definePageMeta({ layout: false });

const route = useRoute();
const { registry } = useComponentRegistry();
const device = ref<PreviewDevice>("desktop");
const refresh = ref(0);
const availableWidth = ref(Number.POSITIVE_INFINITY);
const canvas = ref<HTMLElement | null>(null);
let observer: ResizeObserver | undefined;

const componentId = computed(() => String(route.params.componentId || ""));
const token = computed(() => String(route.query.token || ""));
const definition = computed(() => registry.lookup[componentId.value]);
const frameWidth = computed(() =>
  device.value === "mobile"
    ? `${Math.min(MOBILE_PREVIEW_WIDTH, availableWidth.value)}px`
    : "100%",
);
const renderURL = computed(() => {
  const query = new URLSearchParams({
    token: token.value,
    refresh: String(refresh.value),
  });
  return `/__couchfusion/components/render/${encodeURIComponent(componentId.value)}?${query}`;
});

const updateAvailableWidth = () => {
  const width = canvas.value?.clientWidth || 0;
  if (width > 0) {
    availableWidth.value = width;
  }
};

onMounted(() => {
  updateAvailableWidth();
  if (canvas.value && typeof ResizeObserver !== "undefined") {
    observer = new ResizeObserver(updateAvailableWidth);
    observer.observe(canvas.value);
  }
});

onBeforeUnmount(() => observer?.disconnect());
</script>

<template>
  <main class="component-preview-shell">
    <header class="component-preview-toolbar">
      <div>
        <p>Component preview</p>
        <h1>{{ definition?.label || componentId }}</h1>
        <code>{{ componentId }}</code>
      </div>
      <div class="component-preview-actions">
        <ClientOnly>
          <PreviewDeviceToggle v-model="device" />
          <template #fallback>
            <span class="component-preview-device-placeholder" aria-hidden="true" />
          </template>
        </ClientOnly>
        <button
          type="button"
          class="component-preview-refresh"
          aria-label="Refresh preview"
          @click="refresh += 1"
        >
          Refresh
        </button>
      </div>
    </header>
    <section ref="canvas" class="component-preview-canvas">
      <iframe
        :key="refresh"
        :src="renderURL"
        :style="{ width: frameWidth }"
        :data-refresh="refresh"
        data-render-frame
        :title="`Render preview for ${definition?.label || componentId}`"
      />
    </section>
  </main>
</template>

<style scoped>
:global(html),
:global(body),
:global(#__nuxt) {
  width: 100%;
  height: 100%;
  margin: 0;
}

.component-preview-shell {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  width: 100%;
  height: 100%;
  min-height: 100vh;
  background: #e9ebe9;
  color: #111827;
}

.component-preview-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #d1d5db;
  background: #fff;
}

.component-preview-toolbar p,
.component-preview-toolbar h1 {
  margin: 0;
}

.component-preview-toolbar p,
.component-preview-toolbar code {
  font: 0.7rem/1.3 ui-monospace, monospace;
}

.component-preview-toolbar h1 {
  font: 700 1rem/1.25 system-ui, sans-serif;
}

.component-preview-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.component-preview-device-placeholder {
  width: 5rem;
  height: 2.5rem;
}

.component-preview-refresh {
  min-height: 2.5rem;
  padding: 0 0.8rem;
  border: 1px solid #d1d5db;
  border-radius: 0.45rem;
  background: #fff;
  cursor: pointer;
}

.component-preview-canvas {
  display: flex;
  min-width: 0;
  min-height: 0;
  justify-content: center;
  padding: 1rem;
  overflow: hidden;
}

iframe {
  height: 100%;
  border: 0;
  background: #fff;
  box-shadow: 0 1rem 3rem rgba(17, 24, 39, 0.12);
  transition: width 160ms ease;
}
</style>
