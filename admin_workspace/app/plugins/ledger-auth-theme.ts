import "#admin-workspace/app/assets/css/ledger-auth.css";

/**
 * Applies the Ledger theme to the auth layer's login page, which renders
 * outside the admin shell. The page itself is not modified: this plugin tags
 * <html> on the login route and the stylesheet is scoped to that tag.
 */
export default defineNuxtPlugin(() => {
  const route = useRoute();
  const appConfig = useAppConfig();
  const runtimeConfig = useRuntimeConfig();
  const { isLedgerTheme } = useAdminWorkspaceTheme();

  const loginPath = computed(() => String(runtimeConfig.public?.authLoginPath || "/login"));
  const isActive = computed(() => isLedgerTheme.value && route.path === loginPath.value);
  const brandName = computed(() => String(appConfig.adminWorkspace?.brandName ?? ""));
  const cssString = (value: string) => `"${value.replace(/["\\\n]/g, "")}"`;

  useHead(() =>
    isActive.value
      ? {
          htmlAttrs: {
            class: "aw-theme-ledger-auth",
            style: `--aw-brand-name: ${cssString(brandName.value)}; --aw-brand-initial: ${cssString(brandName.value.trim().charAt(0).toUpperCase())};`,
          },
          link: LEDGER_FONT_LINKS,
        }
      : {},
  );
});
