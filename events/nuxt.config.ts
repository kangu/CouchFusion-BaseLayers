import { fileURLToPath } from "node:url";

export default defineNuxtConfig({
  alias: {
    "#events": fileURLToPath(new URL(".", import.meta.url)),
  },
  extends: ["../auth"],
  modules: [
    fileURLToPath(new URL("./utils/register-layout", import.meta.url)),
  ],
  appConfig: {
    adminWorkspace: {
      sections: [
        {
          id: "events",
          title: "Events",
          requiresRoles: ["admin", "curator"],
          items: [
            {
              label: "Conferences",
              route: "/admin/events/conferences",
              icon: "mdi:calendar-star",
              requiresRoles: ["admin", "curator"],
            },
          ],
        },
      ],
    },
    uiNavigation: {
      sections: [
        {
          id: "events",
          title: "Events",
          requiresRoles: ["admin", "curator"],
          items: [
            {
              label: "Conferences",
              route: "/admin/events/conferences",
              icon: "mdi:calendar-star",
              requiresRoles: ["admin", "curator"],
            },
          ],
        },
      ],
    },
  },
});
