<script setup lang="ts">
import type { SidebarNavigationSection } from "../composables/useSidebarNavigation";

interface SidebarNavigationProps {
  sections: SidebarNavigationSection[];
  variant?: "desktop" | "mobile";
  collapsed?: boolean;
}

const props = withDefaults(defineProps<SidebarNavigationProps>(), {
  variant: "desktop",
  collapsed: false,
});

const emit = defineEmits<{
  (event: "navigate"): void;
}>();

const isMobile = computed(() => props.variant === "mobile");
const isCollapsed = computed(() => !isMobile.value && props.collapsed);
const activeTooltip = ref<{
  label: string;
  top: number;
} | null>(null);

const handleNavigate = () => {
  emit("navigate");
};

const showTooltip = (item: { label: string }, event: Event) => {
  if (!isCollapsed.value || !(event.currentTarget instanceof HTMLElement)) {
    return;
  }

  const rect = event.currentTarget.getBoundingClientRect();
  activeTooltip.value = {
    label: item.label,
    top: rect.top + rect.height / 2,
  };
};

const hideTooltip = () => {
  activeTooltip.value = null;
};
</script>

<template>
  <div class="aw-nav">
    <div
      v-for="(section, sectionIndex) in sections"
      :key="section.id"
      class="aw-nav-section mb-8"
    >
      <h3
        class="aw-nav-section-title px-2 text-xs font-semibold text-gray-400 uppercase tracking-wider"
        :class="[
          isMobile ? 'mb-4' : 'mb-3',
          isCollapsed ? 'sr-only' : '',
        ]"
      >
        {{ section.title }}
      </h3>
      <ul
        class="aw-nav-items"
        :class="isMobile ? 'space-y-2' : isCollapsed ? 'space-y-2' : 'space-y-1'"
      >
        <li
          v-for="(item, itemIndex) in section.items"
          :key="item.route"
          class="aw-nav-item"
        >
          <Transition
            v-if="isMobile"
            appear
            enter-active-class="transition-all duration-300 ease-out"
            enter-from-class="opacity-0 translate-x-4"
            enter-to-class="opacity-100 translate-x-0"
            :style="{
              'transition-delay': `${(sectionIndex * section.items.length + itemIndex) * 50}ms`,
            }"
          >
            <NuxtLink
              :to="item.route"
              @click="handleNavigate"
              class="aw-nav-link aw-nav-link-mobile group flex items-center px-3 py-3 text-base font-medium rounded-lg text-gray-700 hover:bg-gray-50 hover:text-gray-900 active:bg-gray-100 transition-colors min-h-[44px]"
              active-class="aw-nav-link-active bg-orange-50 text-orange-600 border-r-2 border-orange-600"
            >
              <Icon
                :name="item.icon"
                class="aw-nav-icon aw-nav-icon-mobile mr-4 h-6 w-6 flex-shrink-0 text-gray-400 group-hover:text-gray-600 transition-colors"
              />
              {{ item.label }}
            </NuxtLink>
          </Transition>
          <NuxtLink
            v-else
            :to="item.route"
            class="aw-nav-link aw-nav-link-desktop group relative flex items-center text-sm font-medium text-gray-700 transition-all duration-200 hover:bg-gray-50 hover:text-gray-900"
            :class="isCollapsed ? 'aw-nav-link-collapsed justify-center rounded-2xl px-0 py-3' : 'rounded-md px-2 py-2'"
            :aria-label="isCollapsed ? item.label : undefined"
            active-class="aw-nav-link-active bg-gray-100 text-gray-900"
            @mouseenter="showTooltip(item, $event)"
            @mouseleave="hideTooltip"
            @focus="showTooltip(item, $event)"
            @blur="hideTooltip"
          >
            <Icon
              :name="item.icon"
              class="aw-nav-icon aw-nav-icon-desktop text-gray-400 transition-all duration-200 ease-out group-hover:text-gray-600"
              :class="isCollapsed ? 'aw-nav-icon-collapsed mr-0 h-6 w-6 group-hover:scale-110 group-focus-visible:scale-110' : 'mr-3 h-5 w-5'"
            />
            <span
              v-if="!isCollapsed"
              class="aw-nav-label truncate"
            >
              {{ item.label }}
            </span>
            <span
              v-if="isCollapsed"
              class="sr-only"
              role="tooltip"
            >
              {{ item.label }}
            </span>
          </NuxtLink>
        </li>
      </ul>
    </div>
    <Transition name="aw-nav-tooltip-motion">
      <span
        v-if="isCollapsed && activeTooltip"
        class="aw-nav-tooltip pointer-events-none fixed left-[4.75rem] z-50 whitespace-nowrap rounded-2xl border border-white/20 bg-gray-950/90 px-3 py-2 text-xs font-medium text-white opacity-100 shadow-[0_18px_45px_-24px_rgba(15,23,42,0.85)] backdrop-blur-xl"
        :style="{ top: `${activeTooltip.top}px` }"
        role="tooltip"
      >
        {{ activeTooltip.label }}
      </span>
    </Transition>
  </div>
</template>

<style scoped>
.aw-nav-tooltip {
  transform: translate3d(0, -50%, 0) scale(1);
}

.aw-nav-tooltip-motion-enter-active,
.aw-nav-tooltip-motion-leave-active {
  transition:
    opacity 180ms ease,
    transform 200ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.aw-nav-tooltip-motion-enter-from,
.aw-nav-tooltip-motion-leave-to {
  opacity: 0;
  transform: translate3d(-10px, -50%, 0) scale(0.96);
}

.aw-nav-tooltip-motion-enter-to,
.aw-nav-tooltip-motion-leave-from {
  opacity: 1;
  transform: translate3d(0, -50%, 0) scale(1);
}
</style>
