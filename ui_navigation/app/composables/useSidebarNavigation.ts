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
}

/**
 * Build member/admin sidebar navigation sections with role-aware filtering
 * and layer-provided section contributions from app config.
 */
export const useSidebarNavigation = (options: SidebarNavigationOptions = {}) => {
  const appConfig = useAppConfig();
  const hasRole = options.hasRole ?? (() => false);

  const sections = computed<SidebarNavigationSection[]>(() => {
    const baseSections = buildBaseSections(hasRole);
    const configuredSections = normalizeConfiguredSections(
      appConfig.uiNavigation?.sections,
    );
    const mergedSections = dedupeSections([...baseSections, ...configuredSections]);

    return filterSectionsByRole(mergedSections, hasRole);
  });

  return {
    sections,
  };
};

/**
 * Define the default sections used by member/admin layouts.
 */
const buildBaseSections = (
  hasRole: (role: string) => boolean,
): SidebarNavigationSection[] => {
  const sections: SidebarNavigationSection[] = [
    {
      id: "main",
      title: "Main",
      items: [
        {
          label: "Dashboard",
          route: "/dashboard",
          icon: "mdi:view-dashboard-outline",
        },
        {
          label: "Profile",
          route: "/profile",
          icon: "mdi:account-circle-outline",
        },
      ],
    },
    {
      id: "members",
      title: "Members",
      items: [
        {
          label: "Jobs Feed",
          route: "/members/jobs",
          icon: "mdi:magnify",
        },
        {
          label: "Community Offers",
          route: "/members/community-offerings",
          icon: "mdi:briefcase-check-outline",
        },
      ],
    },
    {
      id: "resources",
      title: "Resources",
      items: [
        {
          label: "CV Doctor",
          route: "/members/cv-doctor",
          icon: "mdi:stethoscope",
        },
      ],
    },
  ];

  if (hasRole("organizer") || hasRole("admin")) {
    sections.push({
      id: "organizer",
      title: "Organizer",
      items: [
        {
          label: "Meetups",
          route: "/organizer/meetups",
          icon: "mdi:calendar-star",
        },
      ],
    });
  }

  if (hasRole("admin")) {
    sections.push({
      id: "admin",
      title: "Admin",
      items: [
        {
          label: "Settings",
          route: "/admin/settings",
          icon: "mdi:cog-outline",
        },
        {
          label: "Orders",
          route: "/admin/orders",
          icon: "mdi:receipt-outline",
        },
        {
          label: "Content",
          route: "/admin/content",
          icon: "mdi:file-document-edit-outline",
        },
        {
          label: "Email Templates",
          route: "/admin/email-templates",
          icon: "mdi:email-outline",
        },
        {
          label: "Email Logs",
          route: "/admin/email-logs",
          icon: "mdi:email-check-outline",
        },
        {
          label: "Users",
          route: "/admin/users",
          icon: "mdi:account-group-outline",
        },
        {
          label: "Surveys",
          route: "/admin/surveys",
          icon: "mdi:poll",
        },
      ],
    });
  }

  return sections;
};

/**
 * Normalize layer/app-configured navigation sections into a safe array.
 */
const normalizeConfiguredSections = (
  input: unknown,
): SidebarNavigationSection[] => {
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
 * Remove duplicate sections/items when layer appConfig arrays are merged.
 */
const dedupeSections = (
  sections: SidebarNavigationSection[],
): SidebarNavigationSection[] => {
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

    const mergedItems = new Map(
      existing.items.map((item) => [item.route, item]),
    );
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
