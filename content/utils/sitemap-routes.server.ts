import { promises as fs, Dirent } from "node:fs";
import { extname, join } from "node:path";

const PAGE_EXTENSIONS = new Set([
  ".vue",
  ".js",
  ".ts",
  ".jsx",
  ".tsx",
  ".mjs",
  ".cjs",
]);

const isDynamicSegment = (segment: string): boolean => segment.includes("[");

const normaliseSegment = (segment: string): string => {
  return segment.replace(/\.(client|server)$/, "");
};

const normaliseRoutePath = (segments: string[]): string => {
  const cleaned = segments.filter((segment) => segment.length > 0);

  if (!cleaned.length) {
    return "/";
  }

  return `/${cleaned.join("/")}`;
};

const collectPageRoutes = async (
  directory: string,
  baseSegments: string[] = [],
): Promise<string[]> => {
  let entries: Dirent[];

  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch (error: any) {
    if (error?.code === "ENOENT") {
      return [];
    }

    console.warn(
      "[content-layer] Failed to read pages directory for sitemap:",
      error,
    );
    return [];
  }

  const routes: string[] = [];

  for (const entry of entries) {
    const name = entry.name;

    if (!name || name.startsWith(".") || name.startsWith("_")) {
      continue;
    }

    if (isDynamicSegment(name)) {
      continue;
    }

    if (entry.isDirectory()) {
      const newSegments = [...baseSegments, name];
      const subroutes = await collectPageRoutes(
        join(directory, name),
        newSegments,
      );
      routes.push(...subroutes);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const extension = extname(name);
    if (!PAGE_EXTENSIONS.has(extension)) {
      continue;
    }

    const filename = normaliseSegment(name.slice(0, -extension.length));
    if (!filename || filename.startsWith("[") || filename === "error") {
      continue;
    }

    const segments = [...baseSegments];

    if (filename !== "index") {
      segments.push(filename);
    }

    const route = normaliseRoutePath(segments);
    routes.push(route);
  }

  return routes;
};

const writeStaticRoutesArtifact = async (
  buildDir: string,
  routes: string[],
) => {
  const targetDir = join(buildDir, "content-layer");
  const targetFile = join(targetDir, "sitemap-static-routes.mjs");
  const jsonContent = JSON.stringify(routes, null, 2);
  const moduleSource = `export const routes = ${jsonContent};\nexport default routes;\n`;

  await fs.mkdir(targetDir, { recursive: true });
  await fs.writeFile(targetFile, moduleSource, "utf8");
};

export default async function contentLayerSitemapModule(
  _moduleOptions: any,
  nuxt: any,
) {
  const pagesDir = join(
    nuxt.options.srcDir,
    nuxt.options.dir?.pages || "pages",
  );
  let cachedRoutes: string[] = [];

  const updateRoutes = async () => {
    const discovered = await collectPageRoutes(pagesDir);
    const uniqueSorted = Array.from(new Set(discovered)).sort((a, b) =>
      a.localeCompare(b),
    );
    cachedRoutes = uniqueSorted;

    nuxt.options.appConfig = nuxt.options.appConfig || {};
    const contentConfig = nuxt.options.appConfig.content || {};

    nuxt.options.appConfig.content = {
      ...contentConfig,
      sitemapStaticRoutes: cachedRoutes,
    };

    nuxt.options.runtimeConfig = nuxt.options.runtimeConfig || {};
    const runtimeContentConfig = nuxt.options.runtimeConfig.content || {};
    const runtimeSitemapConfig = runtimeContentConfig.sitemap || {};

    nuxt.options.runtimeConfig.content = {
      ...runtimeContentConfig,
      sitemap: {
        ...runtimeSitemapConfig,
        staticRoutes: cachedRoutes,
      },
    };

    await writeStaticRoutesArtifact(nuxt.options.buildDir, cachedRoutes);
  };

  const ensureRoutesSynced = async () => {
    try {
      await updateRoutes();
    } catch (error) {
      console.error(
        "[content-layer] Failed to update sitemap static routes:",
        error,
      );
    }
  };

  await ensureRoutesSynced();

  nuxt.hook("builder:watch", ensureRoutesSynced);
  nuxt.hook("nitro:build:before", ensureRoutesSynced);
  nuxt.hook("nitro:config", (config: any) => {
    config.runtimeConfig = config.runtimeConfig || {};
    const runtimeContent = config.runtimeConfig.content || {};
    const runtimeSitemap = runtimeContent.sitemap || {};

    config.runtimeConfig.content = {
      ...runtimeContent,
      sitemap: {
        ...runtimeSitemap,
        staticRoutes: cachedRoutes,
      },
    };
  });
}

