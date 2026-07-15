import { fileURLToPath } from "node:url";

type PreviewEnvironment = Record<string, string | undefined>;

const previewFile = (name: string) =>
  fileURLToPath(
    new URL(`../runtime/component-preview/${name}`, import.meta.url),
  );

export const previewEnabled = (environment: PreviewEnvironment): boolean =>
  environment.COUCHFUSION_PREVIEW === "1";

export default async function registerComponentPreviewPages(
  _moduleOptions: unknown,
  nuxt: any,
  environment: PreviewEnvironment = process.env,
) {
  if (!previewEnabled(environment)) {
    return;
  }

  const pages = [
    {
      name: "couchfusion-component-preview",
      path: "/__couchfusion/components/preview/:componentId",
      file: previewFile("ComponentPreviewShell.vue"),
    },
    {
      name: "couchfusion-component-render",
      path: "/__couchfusion/components/render/:componentId",
      file: previewFile("ComponentPreviewRender.vue"),
    },
  ];

  nuxt.hook("pages:extend", (registeredPages: any[]) => {
    for (const page of pages) {
      if (
        !registeredPages.some(
          (candidate) =>
            candidate.name === page.name || candidate.path === page.path,
        )
      ) {
        registeredPages.push(page);
      }
    }
  });

  nuxt.options.nitro ||= {};
  nuxt.options.nitro.handlers ||= [];
  nuxt.options.nitro.handlers.push({
    handler: previewFile("guard.ts"),
    middleware: true,
  });
}
