import { fileURLToPath } from "node:url";

export default defineNuxtConfig({
  // This layer provides shared database utilities and CouchDB functionality
  // Available to all layers and apps that extend this layer

  alias: {
    "#database": fileURLToPath(new URL(".", import.meta.url)),
  },
  modules: [fileURLToPath(new URL("./utils/register-layout", import.meta.url))],
  appConfig: {
    uiNavigation: {
      sections: [
        {
          id: "database",
          title: "Database",
          requiresRoles: ["admin"],
          items: [
            {
              label: "Data Sync",
              route: "/admin/datasync",
              icon: "mdi:database-sync",
            },
          ],
        },
      ],
    },
  },
});
