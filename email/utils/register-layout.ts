import { fileURLToPath } from "node:url";

export default function registerEmailLayoutModule(_options: any, nuxt: any) {
  const layerRoot = fileURLToPath(new URL("..", import.meta.url));

  nuxt.hook("pages:extend", (pages: any[]) => {
    const layout =
      nuxt.options.appConfig?.uiNavigation?.adminLayout || "admin-workspace";

    for (const page of pages) {
      if (page.file?.startsWith(layerRoot)) {
        page.meta = page.meta || {};
        page.meta.layout = layout;
      }
    }
  });
}
