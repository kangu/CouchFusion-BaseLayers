export const LEDGER_FONT_LINKS = [
  { key: "aw-ledger-fonts-preconnect", rel: "preconnect", href: "https://fonts.gstatic.com", crossorigin: "anonymous" as const },
  {
    key: "aw-ledger-fonts",
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500&display=swap",
  },
];

/**
 * Resolve the admin workspace theme. "ledger" is the default look; apps that
 * ship their own themeClass keep "classic" unless they opt in explicitly.
 */
export const useAdminWorkspaceTheme = () => {
  const appConfig = useAppConfig();

  const isLedgerTheme = computed(() => {
    const config = (appConfig.adminWorkspace ?? {}) as { theme?: unknown; themeClass?: unknown };
    if (config.theme === "ledger" || config.theme === "classic") {
      return config.theme === "ledger";
    }
    return !(typeof config.themeClass === "string" && config.themeClass);
  });

  return { isLedgerTheme };
};
