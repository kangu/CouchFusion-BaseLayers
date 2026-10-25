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
const auth = useCouchDBAuth()
const route = useRoute()
const mobileOpen = ref(false)
const title = useCouchDBAdminTitle()
const admin = computed(() => auth.settings.value?.admin)
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
    await navigateTo(
      safeRedirect(auth.settings.value?.auth.loginPath, '/login'),
    )
  } catch {
    /* The shared error is rendered below. */
  }
}
</script>
<template>
  <div
    class="aw-shell"
    :class="[
      `aw-theme-${admin?.theme || 'ledger'}`,
      { 'menu-open': mobileOpen },
    ]"
    data-testid="admin-shell"
  >
    <a class="skip-link" href="#aw-main">Skip to content</a>
    <button
      v-if="mobileOpen"
      class="scrim"
      aria-label="Close navigation"
      @click="mobileOpen = false"
    />
    <aside id="aw-navigation" class="sidebar" aria-label="Workspace navigation">
      <NuxtLink class="brand" to="/admin">{{
        admin?.brandName || 'CouchFusion'
      }}</NuxtLink>
      <p class="site-name">{{ admin?.siteName || 'Administration' }}</p>
      <nav>
        <section v-for="section in sections" :key="section.id">
          <h2>{{ section.title }}</h2>
          <NuxtLink
            v-for="item in section.items"
            :key="item.route"
            :to="item.route"
            :class="{
              active:
                isNavigationActive(item.route, route.path) ||
                item.activeRoutes?.some((path) =>
                  isNavigationActive(path, route.path),
                ),
            }"
            @click="mobileOpen = false"
            >{{ item.label }}</NuxtLink
          >
        </section>
      </nav>
      <div class="identity">
        <span class="identity-label">Signed in as</span>
        <strong data-testid="admin-user-name">{{
          auth.user.value?.name
        }}</strong>
        <button
          :disabled="auth.loading.value"
          data-testid="admin-logout"
          @click="signOut"
        >
          Sign out ↗
        </button>
      </div>
      <footer>{{ admin?.footerText }}</footer>
    </aside>
    <div class="workspace">
      <header class="topbar">
        <button
          class="menu-toggle"
          aria-controls="aw-navigation"
          :aria-expanded="mobileOpen"
          @click="mobileOpen = !mobileOpen"
        >
          {{ mobileOpen ? 'Close menu' : 'Menu' }}
        </button>
        <span class="header-title" data-testid="admin-header-title">{{
          pageTitle
        }}</span>
        <div id="aw-header-actions" />
      </header>
      <main id="aw-main" tabindex="-1">
        <p v-if="auth.error.value" role="alert">{{ auth.error.value }}</p>
        <slot />
      </main>
    </div>
  </div>
</template>
<style scoped>
:global(body) {
  margin: 0;
}
.aw-shell {
  --ink: #293028;
  --muted: #73796f;
  --line: #dfe2d8;
  --paper: #f5f5ef;
  display: flex;
  min-height: 100vh;
  color: var(--ink);
  background: var(--paper);
  font-family: system-ui, sans-serif;
}
.aw-theme-classic {
  --paper: #f5f7fa;
  --ink: #263749;
  --line: #dde3eb;
}
.sidebar {
  position: sticky;
  top: 0;
  height: 100vh;
  box-sizing: border-box;
  width: 248px;
  flex-shrink: 0;
  border-right: 1px solid var(--line);
  display: flex;
  flex-direction: column;
  padding: 30px 24px;
  background: #eeefe7;
}
.brand {
  color: inherit;
  font-size: 22px;
  letter-spacing: -0.06em;
  font-weight: 650;
  text-decoration: none;
}
.site-name {
  font-size: 12px;
  color: var(--muted);
  margin: 8px 0 42px;
}
nav {
  flex: 1;
  overflow: auto;
}
nav section {
  margin-bottom: 30px;
}
nav h2 {
  font: 10px monospace;
  letter-spacing: 0.13em;
  text-transform: uppercase;
  color: var(--muted);
  margin-bottom: 12px;
}
nav a {
  display: block;
  padding: 11px 12px;
  margin: 3px -12px;
  color: inherit;
  text-decoration: none;
  border-radius: 3px;
  font-size: 14px;
}
nav a:hover,
nav a.active {
  background: #dfe5d7;
}
.identity {
  display: grid;
  gap: 7px;
  border-top: 1px solid var(--line);
  padding-top: 20px;
}
.identity-label {
  font-size: 11px;
  color: var(--muted);
}
.identity strong {
  font-size: 14px;
  overflow-wrap: anywhere;
}
.identity button {
  justify-self: start;
  margin-top: 8px;
  background: transparent;
  border: 0;
  padding: 0;
  font: 12px inherit;
  cursor: pointer;
  color: var(--ink);
}
footer {
  font-size: 10px;
  color: var(--muted);
  margin-top: 25px;
}
.workspace {
  flex: 1;
  min-width: 0;
}
.topbar {
  display: flex;
  align-items: center;
  gap: 20px;
  min-height: 76px;
  padding: 0 40px;
  border-bottom: 1px solid var(--line);
  background: #fafbf6;
}
.header-title {
  font-size: 13px;
  font-weight: 500;
}
#aw-header-actions {
  margin-left: auto;
}
main {
  padding: 40px;
  outline: none;
}
.menu-toggle,
.scrim {
  display: none;
}
.skip-link {
  position: fixed;
  top: -100px;
  left: 12px;
  z-index: 50;
  background: white;
  padding: 12px;
  color: inherit;
}
.skip-link:focus {
  top: 12px;
}
button:focus-visible,
a:focus-visible {
  outline: 2px solid #657d51;
  outline-offset: 3px;
}
[role='alert'] {
  color: #9a302d;
}
@media (max-width: 760px) {
  .sidebar {
    position: fixed;
    left: 0;
    z-index: 30;
    transform: translateX(-100%);
    transition: transform 0.18s ease;
  }
  .menu-open .sidebar {
    transform: translateX(0);
  }
  .scrim {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 20;
    background: #0006;
    border: 0;
  }
  .menu-toggle {
    display: block;
    background: none;
    border: 1px solid var(--line);
    padding: 8px;
    color: inherit;
  }
  .topbar {
    padding: 0 20px;
    min-height: 64px;
  }
  main {
    padding: 24px 20px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .sidebar {
    transition: none;
  }
}
</style>
