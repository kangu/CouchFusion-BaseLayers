<script setup lang="ts">
import SidebarNavigation from "#admin-workspace/app/components/SidebarNavigation.vue";
import { useSidebarNavigation } from "#admin-workspace/app/composables/useSidebarNavigation";

const appConfig = useAppConfig();
const nuxtApp = useNuxtApp();
const authStore = useAuthStore();
const { user } = storeToRefs(authStore);

const adminWorkspaceConfig = computed(() => appConfig.adminWorkspace ?? {});
const themeClass = computed(() =>
  typeof adminWorkspaceConfig.value.themeClass === "string"
    ? adminWorkspaceConfig.value.themeClass
    : "",
);
const brandName = computed(() => adminWorkspaceConfig.value.brandName ?? "Admin Workspace");
const siteName = computed(() => adminWorkspaceConfig.value.siteName ?? brandName.value);
const footerText = computed(
  () => adminWorkspaceConfig.value.footerText ?? `© ${new Date().getFullYear()} ${brandName.value}`,
);
const SIDEBAR_COLLAPSED_STORAGE_KEY = "adminWorkspace.sidebarCollapsed";
const SIDEBAR_COLLAPSED_COOKIE_KEY = "adminWorkspaceSidebarCollapsed";
const SIDEBAR_PREPAINT_CLASS = "aw-sidebar-precollapsed";
const sidebarCollapsedCookie = useCookie<string>(SIDEBAR_COLLAPSED_COOKIE_KEY, {
  default: () => "false",
  maxAge: 60 * 60 * 24 * 365,
  path: "/",
  sameSite: "lax",
});
const hasSiteLogo = computed(() => Boolean(nuxtApp.vueApp.component("SiteLogo")));
const hasToastNotification = computed(() => Boolean(nuxtApp.vueApp.component("ToastNotification")));
const userInitial = computed(() => {
  const username = (user.value?.name ?? "").trim();
  return username ? username.charAt(0).toUpperCase() : "U";
});

const readSidebarCollapsedPreference = () => {
  if (!import.meta.client) {
    return sidebarCollapsedCookie.value === "true";
  }

  try {
    const storedValue = localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY);
    return storedValue === null
      ? sidebarCollapsedCookie.value === "true"
      : storedValue === "true";
  } catch {
    return sidebarCollapsedCookie.value === "true";
  }
};

const sidebarCollapsed = ref(readSidebarCollapsedPreference());
const sidebarToggleLabel = computed(() => (
  sidebarCollapsed.value ? "Expand sidebar" : "Collapse sidebar"
));

const persistSidebarCollapsedPreference = (value: boolean) => {
  sidebarCollapsedCookie.value = value ? "true" : "false";

  if (!import.meta.client) {
    return;
  }

  try {
    localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, value ? "true" : "false");
  } catch {
    // Ignore storage failures; the interactive state still works for this session.
  }
};

useHead({
  script: [
    {
      key: "admin-workspace-sidebar-preference",
      innerHTML: `;(function(){try{var storageKey='${SIDEBAR_COLLAPSED_STORAGE_KEY}';var cookieKey='${SIDEBAR_COLLAPSED_COOKIE_KEY}';var prepaintClass='${SIDEBAR_PREPAINT_CLASS}';var storedValue=localStorage.getItem(storageKey);var cookieCollapsed=document.cookie.indexOf(cookieKey+'=true')!==-1;var collapsed=storedValue===null?cookieCollapsed:storedValue==='true';if(storedValue!==null){document.cookie=cookieKey+'='+(storedValue==='true'?'true':'false')+'; path=/; max-age=31536000; SameSite=Lax';}if(collapsed){document.documentElement.classList.add(prepaintClass);}}catch(error){}})();`,
      tagPosition: "head",
    },
  ],
});

const {
  sections: navigationSections,
  mobileMenuOpen,
  toggleMobileMenu,
  closeMobileMenu,
} = useSidebarNavigation({
  hasRole: (role) => authStore.hasRole(role),
});

const profileMenuOpen = ref(false);
const profileMenuRef = ref<HTMLElement | null>(null);

const closeProfileMenu = () => {
  profileMenuOpen.value = false;
};

const toggleProfileMenu = () => {
  profileMenuOpen.value = !profileMenuOpen.value;
};

const toggleSidebarCollapsed = () => {
  sidebarCollapsed.value = !sidebarCollapsed.value;
  persistSidebarCollapsedPreference(sidebarCollapsed.value);
};

const handleEditProfile = async () => {
  closeProfileMenu();
  await navigateTo("/profile");
};

const handleLogout = async () => {
  try {
    await authStore.logout();
  } finally {
    closeProfileMenu();
    await navigateTo("/");
  }
};

onMounted(() => {
  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === "Escape" && mobileMenuOpen.value) {
      closeMobileMenu();
    }
  };

  document.addEventListener("keydown", handleKeydown);

  onUnmounted(() => {
    document.removeEventListener("keydown", handleKeydown);
    document.body.classList.remove("overflow-hidden");
  });
});

onMounted(() => {
  const handleClickOutside = (event: MouseEvent) => {
    if (
      profileMenuOpen.value &&
      profileMenuRef.value &&
      !profileMenuRef.value.contains(event.target as Node)
    ) {
      closeProfileMenu();
    }
  };

  const handleEscape = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      closeProfileMenu();
    }
  };

  document.addEventListener("click", handleClickOutside);
  document.addEventListener("keydown", handleEscape);

  onUnmounted(() => {
    document.removeEventListener("click", handleClickOutside);
    document.removeEventListener("keydown", handleEscape);
  });
});

onMounted(async () => {
  sidebarCollapsed.value = readSidebarCollapsedPreference();
  persistSidebarCollapsedPreference(sidebarCollapsed.value);
  await nextTick();
  document.documentElement.classList.remove(SIDEBAR_PREPAINT_CLASS);
});
</script>

<template>
  <div
    class="aw-shell min-h-screen bg-gray-50"
    :class="[themeClass, { 'aw-sidebar-collapsed': sidebarCollapsed }]"
  >
    <aside
      class="aw-sidebar relative z-40 hidden lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:flex-col transition-[width] duration-300 ease-out"
      :class="sidebarCollapsed ? 'lg:w-[4.5rem]' : 'lg:w-64'"
    >
      <button
        type="button"
        class="aw-sidebar-collapse-toggle absolute right-0 top-8 z-50 inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-200/80 bg-white/90 text-gray-500 shadow-[0_10px_30px_-18px_rgba(15,23,42,0.7)] backdrop-blur-xl transition-all duration-200 ease-out hover:border-orange-200 hover:bg-white hover:text-orange-600 hover:shadow-[0_16px_34px_-18px_rgba(249,115,22,0.9)] active:shadow-[0_6px_18px_-14px_rgba(15,23,42,0.8)] focus:outline-none focus-visible:border-gray-300 focus-visible:shadow-[0_12px_30px_-20px_rgba(15,23,42,0.75)]"
        :aria-label="sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'"
        :title="sidebarToggleLabel"
        :aria-pressed="sidebarCollapsed"
        @click="toggleSidebarCollapsed"
      >
        <Icon
          :name="sidebarCollapsed ? 'mdi:chevron-right' : 'mdi:chevron-left'"
          class="aw-sidebar-collapse-icon h-4 w-4 transition-transform duration-300 ease-out"
        />
      </button>
      <div
        class="aw-sidebar-surface flex flex-col flex-grow bg-white border-r border-gray-200 transition-[border-radius,box-shadow] duration-300 ease-out"
        :class="sidebarCollapsed ? 'overflow-visible shadow-[18px_0_40px_-32px_rgba(15,23,42,0.45)]' : 'overflow-y-auto'"
      >
        <div
          class="aw-sidebar-brand relative flex h-16 items-center border-b border-gray-200 transition-all duration-300 ease-out"
          :class="sidebarCollapsed ? 'justify-center px-3 py-4' : 'justify-between px-6 py-4'"
        >
          <div
            class="flex min-w-0 items-center"
            :class="sidebarCollapsed ? 'hidden' : ''"
          >
            <div
              class="h-8 min-w-0 rounded-sm flex items-center justify-center transition-all duration-300 ease-out"
              :class="sidebarCollapsed ? 'mr-0 w-10 overflow-hidden' : 'mr-3'"
            >
              <component
                :is="'SiteLogo'"
                v-if="hasSiteLogo"
                :site-name="siteName"
              />
              <span
                v-else
                class="aw-sidebar-brand-text truncate text-sm font-semibold text-gray-800 transition-all duration-200"
                :class="sidebarCollapsed ? 'w-0 opacity-0' : 'opacity-100'"
              >
                {{ brandName }}
              </span>
            </div>
          </div>
        </div>

        <nav
          class="aw-sidebar-nav flex-1 transition-all duration-300 ease-out"
          :class="sidebarCollapsed ? 'overflow-visible px-3 py-5' : 'overflow-y-auto px-4 py-6'"
        >
          <SidebarNavigation
            :sections="navigationSections"
            :collapsed="sidebarCollapsed"
          />
        </nav>

        <div
          class="aw-sidebar-footer border-t border-gray-200 transition-all duration-300 ease-out"
          :class="sidebarCollapsed ? 'px-3 py-3' : 'px-6 py-4'"
        >
          <p
            class="aw-sidebar-footer-text truncate text-xs text-gray-400 transition-all duration-200"
            :class="sidebarCollapsed ? 'opacity-0' : 'opacity-100'"
          >
            {{ footerText }}
          </p>
        </div>
      </div>
    </aside>

    <Transition
      enter-active-class="transition-all duration-300 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-all duration-300 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="mobileMenuOpen"
        class="aw-mobile-overlay fixed inset-0 z-50 lg:hidden"
      >
        <div
          class="aw-mobile-backdrop fixed inset-0 bg-black bg-opacity-50"
          @click="closeMobileMenu"
        />

        <Transition
          enter-active-class="transition-transform duration-300 ease-out"
          enter-from-class="-translate-x-full"
          enter-to-class="translate-x-0"
          leave-active-class="transition-transform duration-300 ease-in"
          leave-from-class="translate-x-0"
          leave-to-class="-translate-x-full"
        >
          <div class="aw-mobile-panel relative flex flex-col w-full h-full bg-white shadow-xl">
            <div class="aw-mobile-panel-brand flex items-center justify-between p-6 border-b border-gray-200">
              <div class="flex items-center">
                <component
                  :is="'SiteLogo'"
                  v-if="hasSiteLogo"
                  :site-name="siteName"
                />
                <span
                  v-else
                  class="text-sm font-semibold text-gray-800"
                >
                  {{ brandName }}
                </span>
              </div>
              <button
                class="p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500"
                aria-label="Close menu"
                @click="closeMobileMenu"
              >
                <svg
                  class="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <nav class="aw-mobile-nav flex-1 px-6 py-6 overflow-y-auto">
              <SidebarNavigation
                :sections="navigationSections"
                variant="mobile"
                @navigate="closeMobileMenu"
              />
            </nav>

            <div class="aw-mobile-footer px-6 py-4 border-t border-gray-200">
              <p class="aw-mobile-footer-text text-xs text-gray-400">
                {{ footerText }}. All rights reserved.
              </p>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>

    <div
      class="aw-main flex flex-col min-h-screen transition-[margin] duration-300 ease-out"
      :class="sidebarCollapsed ? 'lg:ml-[4.5rem]' : 'lg:ml-64'"
    >
      <header class="aw-header bg-white shadow-sm border-b border-gray-200 lg:static lg:overflow-y-visible">
        <div class="max-w-7xl mx-auto px-4">
          <div class="relative flex justify-between h-16">
            <div class="absolute inset-y-0 left-0 flex items-center lg:hidden">
              <button
                class="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
                @click="toggleMobileMenu"
              >
                <span class="sr-only">Open main menu</span>
                <svg
                  class="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              </button>
            </div>

            <div class="flex-1 flex items-center justify-center px-2 sm:ml-2 lg:justify-start">
              <div class="max-w-[calc(100vw-10rem)] w-full lg:max-w-md" />
            </div>

            <div class="absolute inset-y-0 right-0 flex items-center pr-2 sm:static sm:inset-auto sm:ml-6 sm:pr-0">
              <div
                ref="profileMenuRef"
                class="relative ml-3"
              >
                <button
                  type="button"
                  class="aw-header-profile-trigger flex items-center justify-center rounded-full bg-white text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 overflow-hidden h-9 w-9"
                  aria-label="User menu"
                  aria-haspopup="true"
                  :aria-expanded="profileMenuOpen"
                  @click="toggleProfileMenu"
                >
                  <div
                    class="h-full w-full rounded-full bg-gradient-to-br from-orange-400 to-orange-600 text-white flex items-center justify-center font-semibold shadow-sm"
                  >
                    {{ userInitial }}
                  </div>
                </button>

                <Transition
                  enter-active-class="transition ease-out duration-150"
                  enter-from-class="opacity-0 -translate-y-2"
                  enter-to-class="opacity-100 translate-y-0"
                  leave-active-class="transition ease-in duration-100"
                  leave-from-class="opacity-100 translate-y-0"
                  leave-to-class="opacity-0 -translate-y-2"
                >
                  <div
                    v-if="profileMenuOpen"
                    class="aw-header-profile-menu absolute right-0 z-20 mt-3 w-48 origin-top-right rounded-lg border border-gray-200 bg-white shadow-lg focus:outline-none"
                    role="menu"
                  >
                    <div class="py-1">
                      <button
                        type="button"
                        class="flex w-full items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        role="menuitem"
                        @click="handleEditProfile"
                      >
                        <Icon
                          name="mdi:account-edit"
                          class="mr-3 h-4 w-4 text-orange-500"
                        />
                        Edit Profile
                      </button>
                      <button
                        type="button"
                        class="flex w-full items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                        role="menuitem"
                        @click="handleLogout"
                      >
                        <Icon
                          name="mdi:logout"
                          class="mr-3 h-4 w-4"
                        />
                        Log Out
                      </button>
                    </div>
                  </div>
                </Transition>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main class="aw-content flex-1 overflow-y-auto focus:outline-none bg-gray-50">
        <div class="aw-content-inner py-6">
          <div class="aw-content-container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <slot />
          </div>
        </div>
      </main>
    </div>

    <component
      :is="'ToastNotification'"
      v-if="hasToastNotification"
    />
  </div>
</template>

<style scoped>
@media (min-width: 1024px) {
  :global(html.aw-sidebar-precollapsed) .aw-sidebar {
    width: 4.5rem;
    transition: none !important;
  }

  :global(html.aw-sidebar-precollapsed) .aw-main {
    margin-left: 4.5rem;
    transition: none !important;
  }

  :global(html.aw-sidebar-precollapsed) .aw-sidebar-surface,
  :global(html.aw-sidebar-precollapsed) .aw-sidebar-nav,
  :global(html.aw-sidebar-precollapsed) .aw-sidebar-brand,
  :global(html.aw-sidebar-precollapsed) .aw-sidebar-footer {
    transition: none !important;
  }

  :global(html.aw-sidebar-precollapsed) .aw-sidebar-surface,
  :global(html.aw-sidebar-precollapsed) .aw-sidebar-nav {
    overflow: visible;
  }

  :global(html.aw-sidebar-precollapsed) .aw-sidebar-brand {
    justify-content: center;
    padding: 1rem 0.75rem;
  }

  :global(html.aw-sidebar-precollapsed) .aw-sidebar-brand > div,
  :global(html.aw-sidebar-precollapsed) .aw-sidebar-footer-text,
  :global(html.aw-sidebar-precollapsed) :deep(.aw-nav-section-title),
  :global(html.aw-sidebar-precollapsed) :deep(.aw-nav-label) {
    clip: rect(0 0 0 0);
    height: 1px;
    opacity: 0;
    overflow: hidden;
    position: absolute;
    white-space: nowrap;
    width: 1px;
  }

  :global(html.aw-sidebar-precollapsed) .aw-sidebar-nav {
    padding: 1.25rem 0.75rem;
  }

  :global(html.aw-sidebar-precollapsed) .aw-sidebar-footer {
    padding: 0.75rem;
  }

  :global(html.aw-sidebar-precollapsed) :deep(.aw-nav-items) {
    display: grid;
    gap: 0.5rem;
  }

  :global(html.aw-sidebar-precollapsed) :deep(.aw-nav-link-desktop) {
    border-radius: 1rem;
    justify-content: center;
    padding: 0.75rem 0;
  }

  :global(html.aw-sidebar-precollapsed) :deep(.aw-nav-icon-desktop) {
    height: 1.5rem;
    margin-right: 0;
    width: 1.5rem;
  }
}

.aw-sidebar-collapse-toggle {
  outline: none;
  transform: translate(50%, -50%);
}

.aw-sidebar-collapse-toggle:focus,
.aw-sidebar-collapse-toggle:focus-visible {
  outline: none;
}

.aw-sidebar-collapse-toggle:hover {
  transform: translate(50%, calc(-50% - 1px)) rotate(3deg) scale(1.1);
}

.aw-sidebar-collapse-toggle:active {
  transform: translate(50%, -50%) scale(0.9);
}
</style>
