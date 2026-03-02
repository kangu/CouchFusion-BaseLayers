<script setup lang="ts">
import SidebarNavigation from "#admin-workspace/app/components/SidebarNavigation.vue";
import { useSidebarNavigation } from "#admin-workspace/app/composables/useSidebarNavigation";

const appConfig = useAppConfig();
const nuxtApp = useNuxtApp();
const authStore = useAuthStore();
const { user } = storeToRefs(authStore);

const adminWorkspaceConfig = computed(() => appConfig.adminWorkspace ?? {});
const brandName = computed(() => adminWorkspaceConfig.value.brandName ?? "Admin Workspace");
const siteName = computed(() => adminWorkspaceConfig.value.siteName ?? brandName.value);
const footerText = computed(
  () => adminWorkspaceConfig.value.footerText ?? `© ${new Date().getFullYear()} ${brandName.value}`,
);
const hasSiteLogo = computed(() => Boolean(nuxtApp.vueApp.component("SiteLogo")));
const hasToastNotification = computed(() => Boolean(nuxtApp.vueApp.component("ToastNotification")));
const userInitial = computed(() => user.value?.name?.charAt(0).toUpperCase() || "U");
const userAvatar = computed(() => {
  const avatar = user.value?.profile?.avatar;
  const version = user.value?.profile?.avatarVersion;
  if (!avatar) {
    return null;
  }
  return version ? `${avatar}?v=${version}` : avatar;
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
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <aside class="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:w-64 lg:flex-col">
      <div class="flex flex-col flex-grow bg-white border-r border-gray-200 overflow-y-auto">
        <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div class="flex items-center">
            <div class="h-8 rounded-sm flex items-center justify-center mr-3">
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
          </div>
        </div>

        <nav class="flex-1 px-4 py-6 overflow-y-auto">
          <SidebarNavigation :sections="navigationSections" />
        </nav>

        <div class="px-6 py-4 border-t border-gray-200">
          <p class="text-xs text-gray-400">
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
        class="fixed inset-0 z-50 lg:hidden"
      >
        <div
          class="fixed inset-0 bg-black bg-opacity-50"
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
          <div class="relative flex flex-col w-full h-full bg-white shadow-xl">
            <div class="flex items-center justify-between p-6 border-b border-gray-200">
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

            <nav class="flex-1 px-6 py-6 overflow-y-auto">
              <SidebarNavigation
                :sections="navigationSections"
                variant="mobile"
                @navigate="closeMobileMenu"
              />
            </nav>

            <div class="px-6 py-4 border-t border-gray-200">
              <p class="text-xs text-gray-400">
                {{ footerText }}. All rights reserved.
              </p>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>

    <div class="lg:ml-64 flex flex-col min-h-screen">
      <header class="bg-white shadow-sm border-b border-gray-200 lg:static lg:overflow-y-visible">
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
                  class="flex items-center justify-center rounded-full bg-white text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 overflow-hidden h-9 w-9"
                  aria-label="User menu"
                  aria-haspopup="true"
                  :aria-expanded="profileMenuOpen"
                  @click="toggleProfileMenu"
                >
                  <img
                    v-if="userAvatar"
                    :src="userAvatar"
                    alt="Profile avatar"
                    class="h-full w-full object-cover"
                  />
                  <div
                    v-else
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
                    class="absolute right-0 z-20 mt-3 w-48 origin-top-right rounded-lg border border-gray-200 bg-white shadow-lg focus:outline-none"
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

      <main class="flex-1 overflow-y-auto focus:outline-none bg-gray-50">
        <div class="py-6">
          <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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
