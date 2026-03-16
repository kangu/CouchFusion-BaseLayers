import { fileURLToPath } from "node:url";

export default defineNuxtConfig({
  alias: {
    "#maintenance": fileURLToPath(new URL(".", import.meta.url)),
  },
  appConfig: {
    adminWorkspace: {
      sections: [
        {
          id: "maintenance",
          title: "Maintenance",
          requiresRoles: ["admin", "employee"],
          items: [
            {
              label: "Jobs",
              route: "/admin/maintenance/jobs",
              icon: "mdi:toolbox-outline",
              requiresRoles: ["admin", "employee"],
            },
            {
              label: "Clients",
              route: "/admin/maintenance/clients",
              icon: "mdi:office-building-outline",
              requiresRoles: ["admin"],
            },
            {
              label: "Contracts",
              route: "/admin/maintenance/contracts",
              icon: "mdi:file-document-outline",
              requiresRoles: ["admin"],
            },
            {
              label: "Notifications",
              route: "/admin/maintenance/notifications",
              icon: "mdi:bell-outline",
              requiresRoles: ["admin"],
            },
          ],
        },
      ],
    },
    uiNavigation: {
      sections: [
        {
          id: "maintenance",
          title: "Maintenance",
          requiresRoles: ["admin", "employee"],
          items: [
            {
              label: "Jobs",
              route: "/admin/maintenance/jobs",
              icon: "mdi:toolbox-outline",
              requiresRoles: ["admin", "employee"],
            },
            {
              label: "Clients",
              route: "/admin/maintenance/clients",
              icon: "mdi:office-building-outline",
              requiresRoles: ["admin"],
            },
            {
              label: "Contracts",
              route: "/admin/maintenance/contracts",
              icon: "mdi:file-document-outline",
              requiresRoles: ["admin"],
            },
            {
              label: "Notifications",
              route: "/admin/maintenance/notifications",
              icon: "mdi:bell-outline",
              requiresRoles: ["admin"],
            },
          ],
        },
      ],
    },
  },
});
