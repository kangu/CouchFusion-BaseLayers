<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { navigateTo, useRoute } from '#imports'
import { useCouchDBAuth } from '#core/features/auth-client/app/composables/useCouchDBAuth'
import { useCouchDBAdminTitle } from '#core/features/admin/app/composables/useCouchDBAdminTitle'
import {
  buildAdminNavigation,
  isNavigationActive,
  safeRedirect,
} from '#core/features/admin/app/utils/navigation'
import { useCouchDBThemeHead } from '#core/features/ui-theme/useCouchDBColorScheme'
import CouchMark from '#core/features/ui-theme/CouchMark.vue'
import SchemeToggle from '#core/features/ui-theme/SchemeToggle.vue'

const auth = useCouchDBAuth()
const route = useRoute()
const mobileOpen = ref(false)
const title = useCouchDBAdminTitle()
useCouchDBThemeHead()

const admin = computed(() => auth.settings.value?.admin)
const brandName = computed(() => admin.value?.brandName || 'CouchFusion')
const siteName = computed(() => admin.value?.siteName || 'Administration')
const sections = computed(() =>
  buildAdminNavigation(
    admin.value?.sections.length
      ? admin.value.sections
      : [
          {
            id: 'workspace',
            title: 'Workspace',
            items: [{ label: 'Overview', route: '/admin' }],
          },
        ],
    auth.hasRole,
  ),
)
const pageTitle = computed(
  () => title.value || String(route.meta.title || 'Workspace'),
)
const isActive = (item: { route: string; activeRoutes?: string[] }) =>
  isNavigationActive(item.route, route.path) ||
  Boolean(item.activeRoutes?.some((p) => isNavigationActive(p, route.path)))
const user = computed(() => auth.user.value)
const roleLine = computed(() => user.value?.roles.join(', ') || 'No roles')

watch(
  () => route.path,
  () => {
    mobileOpen.value = false
    title.value = ''
  },
)
async function signOut() {
  try {
    await auth.logout()
    await navigateTo(safeRedirect(auth.settings.value?.auth.loginPath, '/login'))
  } catch {
    /* The shared error is shown above the page. */
  }
}
</script>
<template>
  <div
    class="cf-ui cf-shell"
    :class="{ 'cf-menu-open': mobileOpen }"
    data-testid="admin-shell"
  >
    <a class="cf-skip" href="#aw-main">Skip to content</a>
    <header class="cf-top">
      <button
        type="button"
        class="cf-icon-btn cf-menu-toggle"
        aria-controls="aw-navigation"
        :aria-expanded="mobileOpen"
        aria-label="Open navigation"
        @click="mobileOpen = true"
      >
        <svg class="cf-ic" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11" /></svg>
      </button>
      <NuxtLink class="cf-brand" to="/admin"><CouchMark /><span>{{ brandName }}</span></NuxtLink>
      <nav class="cf-crumbs" aria-label="Breadcrumb">
        <span>{{ siteName }}</span>
        <span aria-current="page" data-testid="admin-header-title">{{ pageTitle }}</span>
      </nav>
      <div id="aw-header-actions" class="cf-top-actions" />
      <SchemeToggle />
    </header>

    <aside id="aw-navigation" class="cf-side" aria-label="Workspace navigation">
      <button
        type="button"
        class="cf-icon-btn cf-menu-close"
        aria-label="Close navigation"
        @click="mobileOpen = false"
      >
        <svg class="cf-ic" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="m4 4 8 8M12 4l-8 8" /></svg>
      </button>
      <nav aria-label="Main">
        <div v-for="section in sections" :key="section.id" class="cf-nav-group">
          <p class="cf-group-label">{{ section.title }}</p>
          <NuxtLink
            v-for="item in section.items"
            :key="item.route"
            :to="item.route"
            class="cf-nav-item"
            :aria-current="isActive(item) ? 'page' : undefined"
            @click="mobileOpen = false"
            ><span>{{ item.label }}</span></NuxtLink
          >
        </div>
      </nav>
      <div class="cf-side-bottom">
        <SchemeToggle />
        <div class="cf-user">
          <span class="cf-avatar" aria-hidden="true">{{ user?.name?.[0] }}</span>
          <span><b data-testid="admin-user-name">{{ user?.name }}</b><span>{{ roleLine }}</span></span>
          <button
            type="button"
            class="cf-icon-btn"
            :disabled="auth.loading.value"
            aria-label="Sign out"
            title="Sign out"
            data-testid="admin-logout"
            @click="signOut"
          >
            <svg class="cf-ic" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 2.5H3.5c-.6 0-1 .4-1 1v9c0 .6.4 1 1 1H6M10.5 11 13.5 8l-3-3M13.5 8H6" /></svg>
          </button>
        </div>
        <p v-if="admin?.footerText" class="cf-footer-text">{{ admin.footerText }}</p>
      </div>
    </aside>

    <main id="aw-main" class="cf-main" tabindex="-1">
      <p v-if="auth.error.value" role="alert" class="cf-alert">{{ auth.error.value }}</p>
      <slot />
    </main>
  </div>
</template>
<style src="../../../ui-theme/terminal.css"></style>
