import { fileURLToPath } from "node:url";

const resolveBuilderComponent = () =>
  fileURLToPath(
    new URL("../pages/builder/[[...target]].vue", import.meta.url),
  );

const BUILDER_ROUTE_PATH = "/builder/:target(.*)*";
const BUILDER_ROUTE_ALIAS_PATH = "/k/:target(.*)*";
const BUILDER_ROUTE_NAME = "content-layer-builder";
const BUILDER_ALIAS_ROUTE_NAME = "content-layer-builder-alias";

export default async function registerContentLayerBuilder(
  _moduleOptions: any,
  nuxt: any,
) {
  const file = resolveBuilderComponent();

  nuxt.hook("pages:extend", (pages: any[]) => {
    const alreadyRegistered = pages.some(
      (page) =>
        page.path === BUILDER_ROUTE_PATH ||
        page.path === BUILDER_ROUTE_ALIAS_PATH ||
        page.file === file ||
        page.name === BUILDER_ROUTE_NAME,
    );

    if (alreadyRegistered) {
      return;
    }

    pages.push({
      name: BUILDER_ROUTE_NAME,
      path: BUILDER_ROUTE_PATH,
      file,
    });

    pages.push({
      name: BUILDER_ALIAS_ROUTE_NAME,
      path: BUILDER_ROUTE_ALIAS_PATH,
      file,
    });
  });
}
