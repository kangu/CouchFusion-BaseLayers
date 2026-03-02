export interface SidebarNavigationItem {
  label: string;
  route: string;
  icon: string;
  requiresRoles?: string[];
}

export interface SidebarNavigationSection {
  id: string;
  title: string;
  items: SidebarNavigationItem[];
  requiresRoles?: string[];
}

export interface SidebarNavigationOptions {
  hasRole?: (role: string) => boolean;
  navItems?: SidebarNavigationSection[];
}

/**
 * Build admin workspace sidebar sections with role-aware filtering.
 * Supports both `appConfig.adminWorkspace.sections` and legacy
 * `appConfig.uiNavigation.sections`.
 */
export const useSidebarNavigation = (options: SidebarNavigationOptions = {}) => {
  const appConfig = useAppConfig();
  const hasRole = options.hasRole ?? (() => false);
  const navItems = options.navItems ?? [];
  const mobileMenuOpen = ref(false);

  const sections = computed<SidebarNavigationSection[]>(() => {
    const baseSections = buildBaseSections(hasRole, navItems);
    const configuredSections = getConfiguredSections(appConfig);
    const mergedSections = dedupeSections([...baseSections, ...configuredSections]);

    return filterSectionsByRole(mergedSections, hasRole);
  });

  const toggleMobileMenu = () => {
    mobileMenuOpen.value = !mobileMenuOpen.value;
    if (mobileMenuOpen.value) {
      document.body.classList.add("overflow-hidden");
      return;
    }
    document.body.classList.remove("overflow-hidden");
  };

  const closeMobileMenu = () => {
    mobileMenuOpen.value = false;
    document.body.classList.remove("overflow-hidden");
  };

  return {
    sections,
    mobileMenuOpen,
    toggleMobileMenu,
    closeMobileMenu,
  };
};

/**
 * Provide default navigation sections when an app does not inject custom ones.
 */
const buildBaseSections = (
  hasRole: (role: string) => boolean,
  navItems: SidebarNavigationSection[],
): SidebarNavigationSection[] => {
  if (navItems.length) {
    return navItems;
  }

  if (hasRole("admin")) {
    return [
      {
        id: "admin",
        title: "Admin",
        items: [
          {
            label: "Dashboard",
            route: "/admin",
            icon: "mdi:view-dashboard-outline",
          },
        ],
      },
    ];
  }

  return [];
};

/**
 * Collect section configuration from new and legacy appConfig keys.
 */
const getConfiguredSections = (appConfig: Record<string, any>): SidebarNavigationSection[] => {
  const adminWorkspaceSections = normalizeConfiguredSections(
    appConfig.adminWorkspace?.sections,
  );
  const uiNavigationSections = normalizeConfiguredSections(
    appConfig.uiNavigation?.sections,
  );

  return [...adminWorkspaceSections, ...uiNavigationSections];
};

/**
 * Normalize app-configured navigation sections into a safe array.
 */
const normalizeConfiguredSections = (input: unknown): SidebarNavigationSection[] => {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((section) => {
      if (!section || typeof section !== "object") {
        return null;
      }

      const typedSection = section as SidebarNavigationSection;
      if (!typedSection.title || !Array.isArray(typedSection.items)) {
        return null;
      }

      return {
        ...typedSection,
        id: typedSection.id || typedSection.title.toLowerCase().replace(/\s+/g, "-"),
      };
    })
    .filter((section): section is SidebarNavigationSection => Boolean(section));
};

/**
 * Filter sections/items based on role requirements and remove empty sections.
 */
const filterSectionsByRole = (
  sections: SidebarNavigationSection[],
  hasRole: (role: string) => boolean,
): SidebarNavigationSection[] => {
  return sections
    .map((section) => {
      if (section.requiresRoles?.length) {
        const allowed = section.requiresRoles.some((role) => hasRole(role));
        if (!allowed) {
          return null;
        }
      }

      const filteredItems = section.items.filter((item) => {
        if (!item.requiresRoles?.length) {
          return true;
        }
        return item.requiresRoles.some((role) => hasRole(role));
      });

      if (!filteredItems.length) {
        return null;
      }

      return {
        ...section,
        items: filteredItems,
      };
    })
    .filter((section): section is SidebarNavigationSection => Boolean(section));
};

/**
 * Deduplicate sections and routes when layers contribute merged arrays.
 */
const dedupeSections = (sections: SidebarNavigationSection[]): SidebarNavigationSection[] => {
  const sectionMap = new Map<string, SidebarNavigationSection>();

  for (const section of sections) {
    const sectionKey = section.id || section.title;
    const existing = sectionMap.get(sectionKey);

    if (!existing) {
      sectionMap.set(sectionKey, {
        ...section,
        items: [...section.items],
        requiresRoles: section.requiresRoles ? [...section.requiresRoles] : undefined,
      });
      continue;
    }

    const mergedItems = new Map(existing.items.map((item) => [item.route, item]));
    for (const item of section.items) {
      if (!mergedItems.has(item.route)) {
        mergedItems.set(item.route, item);
      }
    }

    const mergedRoles = new Set([
      ...(existing.requiresRoles ?? []),
      ...(section.requiresRoles ?? []),
    ]);

    sectionMap.set(sectionKey, {
      ...existing,
      items: Array.from(mergedItems.values()),
      requiresRoles: mergedRoles.size ? Array.from(mergedRoles.values()) : undefined,
    });
  }

  return Array.from(sectionMap.values());
};
