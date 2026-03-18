import { fileURLToPath } from "node:url";

export default defineNuxtConfig({
  alias: {
    "#email": fileURLToPath(new URL(".", import.meta.url)),
  },
  appConfig: {
    adminWorkspace: {
      sections: [
        {
          id: "email",
          title: "Email",
          requiresRoles: ["admin"],
          items: [
            {
              label: "Templates",
              route: "/admin/email-templates",
              icon: "mdi:email-edit-outline",
              requiresRoles: ["admin"],
            },
          ],
        },
      ],
    },
    uiNavigation: {
      sections: [
        {
          id: "email",
          title: "Email",
          requiresRoles: ["admin"],
          items: [
            {
              label: "Templates",
              route: "/admin/email-templates",
              icon: "mdi:email-edit-outline",
              requiresRoles: ["admin"],
            },
          ],
        },
      ],
    },
  },
});
