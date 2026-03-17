<script setup lang="ts">
import type { SidebarNavigationSection } from "../composables/useSidebarNavigation";

interface SidebarNavigationProps {
  sections: SidebarNavigationSection[];
  variant?: "desktop" | "mobile";
}

const props = withDefaults(defineProps<SidebarNavigationProps>(), {
  variant: "desktop",
});

const emit = defineEmits<{
  (event: "navigate"): void;
}>();

const isMobile = computed(() => props.variant === "mobile");

const handleNavigate = () => {
  emit("navigate");
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
        :class="isMobile ? 'mb-4' : 'mb-3'"
      >
        {{ section.title }}
      </h3>
      <ul
        class="aw-nav-items"
        :class="isMobile ? 'space-y-2' : 'space-y-1'"
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
            class="aw-nav-link aw-nav-link-desktop group flex items-center px-2 py-2 text-sm font-medium rounded-md text-gray-700 hover:bg-gray-50 hover:text-gray-900"
            active-class="aw-nav-link-active bg-gray-100 text-gray-900"
          >
            <Icon
              :name="item.icon"
              class="aw-nav-icon aw-nav-icon-desktop mr-3 h-5 w-5 text-gray-400 group-hover:text-gray-600 transition-colors"
            />
            {{ item.label }}
          </NuxtLink>
        </li>
      </ul>
    </div>
  </div>
</template>
