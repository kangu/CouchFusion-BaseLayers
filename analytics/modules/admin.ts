/**
 * Registers the self-hosted analytics admin module when the consuming app sets
 * `runtimeConfig.public.analytics.admin.enabled = true`:
 *  - pages under `/admin/analytics/**` (admin-workspace layout, host-overridable
 *    via `appConfig.adminWorkspace.layout`) and the public, login-free
 *    `/admin/analytics/share/:token` (kept under the content layer's reserved
 *    `/admin` prefix so the CMS catch-all never claims it)
 *  - an "Analytics" sidebar section in `appConfig.adminWorkspace.sections`
 * Apps that only forward to Umami Cloud get none of this.
 */
import { fileURLToPath } from "node:url";

const page = (name: string) => fileURLToPath(new URL(`../admin/pages/${name}.vue`, import.meta.url));

export const SHARE_PATH = "/admin/analytics/share/:token";

const ROLES = ["admin", "analytics_viewer"];

const ADMIN_PAGES = [
  { name: "analytics-overview", path: "/admin/analytics", file: "Overview" },
  { name: "analytics-realtime", path: "/admin/analytics/realtime", file: "Realtime" },
  { name: "analytics-events", path: "/admin/analytics/events", file: "Events" },
  { name: "analytics-sessions", path: "/admin/analytics/sessions", file: "Sessions" },
  { name: "analytics-reports", path: "/admin/analytics/reports", file: "Reports" },
  { name: "analytics-settings", path: "/admin/analytics/settings", file: "Settings" },
  { name: "analytics-tools", path: "/admin/analytics/tools", file: "Tools" },
  { name: "analytics-api-keys", path: "/admin/analytics/api-keys", file: "ApiKeys" },
];

const NAV_SECTION = {
  id: "analytics",
  title: "Analytics",
  requiresRoles: ROLES,
  items: [
    { label: "Overview", route: "/admin/analytics", icon: "mdi:chart-areaspline", requiresRoles: ROLES },
    { label: "Realtime", route: "/admin/analytics/realtime", icon: "mdi:pulse", requiresRoles: ROLES },
    { label: "Events", route: "/admin/analytics/events", icon: "mdi:gesture-tap-button", requiresRoles: ROLES },
    { label: "Sessions", route: "/admin/analytics/sessions", icon: "mdi:account-clock-outline", requiresRoles: ROLES },
    { label: "Reports", route: "/admin/analytics/reports", icon: "mdi:filter-variant", requiresRoles: ROLES },
    { label: "Settings", route: "/admin/analytics/settings", icon: "mdi:cog-outline", requiresRoles: ["admin"] },
    { label: "Pixels, links & import", route: "/admin/analytics/tools", icon: "mdi:link-variant", requiresRoles: ["admin"] },
    { label: "API keys", route: "/admin/analytics/api-keys", icon: "mdi:key-variant", requiresRoles: ["admin"] },
  ],
};

export default function registerAnalyticsAdminModule(_options: unknown, nuxt: any) {
  const enabled = Boolean(nuxt.options.runtimeConfig?.public?.analytics?.admin?.enabled);
  if (!enabled) return;

  const appConfig = (nuxt.options.appConfig ??= {});
  const adminWorkspace = (appConfig.adminWorkspace ??= {});
  const sections = Array.isArray(adminWorkspace.sections) ? adminWorkspace.sections : [];
  if (!sections.some((section: any) => section?.id === NAV_SECTION.id)) {
    adminWorkspace.sections = [...sections, NAV_SECTION];
  }

  nuxt.hook("pages:extend", (pages: any[]) => {
    const layout = appConfig.adminWorkspace?.layout || appConfig.uiNavigation?.adminLayout || "admin-workspace";
    for (const entry of ADMIN_PAGES) {
      if (pages.some((existing) => existing.path === entry.path)) continue;
      pages.push({ name: entry.name, path: entry.path, file: page(entry.file), meta: { layout } });
    }
    if (!pages.some((existing) => existing.path === SHARE_PATH)) {
      pages.push({ name: "analytics-share", path: SHARE_PATH, file: page("Share"), meta: { layout: false } });
    }
  });
}
