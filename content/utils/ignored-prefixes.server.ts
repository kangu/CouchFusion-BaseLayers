import { promises as fs, Dirent } from "node:fs";
import { extname, join } from "node:path";

const PAGE_FILE_EXTENSIONS = new Set([
  ".vue",
  ".ts",
  ".js",
  ".jsx",
  ".tsx",
  ".mjs",
  ".cjs",
]);

const normalizePrefix = (value: string | null | undefined): string | null => {
  if (!value || typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed.startsWith("/")) {
    return null;
  }

  if (trimmed === "/") {
    return "/";
  }

  return trimmed.replace(/\/+$/, "");
};

const normalisePrefixList = (input: any): string[] =>
  Array.isArray(input)
    ? input
        .map((prefix) => normalizePrefix(prefix))
        .filter((value): value is string => Boolean(value))
    : [];

/**
 * Route-prefix matcher where `/` is treated as exact-only.
 */
const matchesPrefix = (path: string, prefix: string): boolean => {
  if (prefix === "/") {
    return path === "/";
  }

  return path.startsWith(prefix);
};

const applyAllowOverrides = (
  ignored: string[],
  allowed: string[],
): string[] => {
  if (!allowed.length) {
    return Array.from(new Set(ignored)).sort((a, b) => a.localeCompare(b));
  }

  return Array.from(new Set(ignored))
    .filter(
      (ignoredPrefix) =>
        !allowed.some((allowedPrefix) =>
          matchesPrefix(ignoredPrefix, allowedPrefix),
        ),
    )
    .sort((a, b) => a.localeCompare(b));
};

const getPagesDir = (nuxt: any) => {
  const pagesDir = nuxt.options.dir?.pages || "pages";
  return join(nuxt.options.srcDir, pagesDir);
};

const collectStaticPagePrefixes = async (
  directory: string,
): Promise<string[]> => {
  let entries: Dirent[];
  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch (error: any) {
    if (error?.code === "ENOENT") {
      return [];
    }

    console.warn("[content-layer] Failed to read pages directory:", error);
    return [];
  }

  const prefixes = new Set<string>();

  for (const entry of entries) {
    const name = entry.name;

    if (
      !name ||
      name.startsWith("_") ||
      name.startsWith("[") ||
      name.startsWith(".")
    ) {
      continue;
    }

    if (entry.isDirectory()) {
      prefixes.add(`/${name}`);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const extension = extname(name);
    if (!PAGE_FILE_EXTENSIONS.has(extension)) {
      continue;
    }

    const base = name.slice(0, -extension.length);
    if (!base || base === "index" || base.startsWith("[") || base === "error") {
      continue;
    }

    prefixes.add(`/${base}`);
  }

  return Array.from(prefixes);
};

export default async function contentLayerIgnoredPrefixesModule(
  _moduleOptions: any,
  nuxt: any,
) {
  nuxt.options.appConfig = nuxt.options.appConfig || {};
  const pagesDir = getPagesDir(nuxt);
  const autoPrefixes = await collectStaticPagePrefixes(pagesDir);
  const autoNormalised = normalisePrefixList(autoPrefixes);

  const applyContentConfig = (
    contentConfig: Record<string, any> | undefined | null,
  ) => {
    const manualPrefixesInput =
      contentConfig?.manualIgnoredPrefixes ??
      contentConfig?.manualPrefixes ??
      [];

    const manualNormalised = normalisePrefixList(manualPrefixesInput);

    const allowInput = contentConfig?.allow ?? contentConfig?.allowedPrefixes ?? [];
    const allowNormalised = normalisePrefixList(allowInput);

    const merged = applyAllowOverrides(
      [...autoNormalised, ...manualNormalised],
      allowNormalised,
    );

    return {
      ...contentConfig,
      autoIgnoredPrefixes: autoNormalised,
      manualIgnoredPrefixes: manualNormalised,
      ignoredPrefixes: merged,
      allow: allowNormalised,
      allowedPrefixes: allowNormalised,
    };
  };

  // Expose merged ignore/allow values to runtimeConfig.content for server-side consumers.
  nuxt.options.runtimeConfig = nuxt.options.runtimeConfig || {};
  const runtimeContent = nuxt.options.runtimeConfig.content || {};

  const runtimeIgnore = normalisePrefixList(runtimeContent.ignore ?? []);
  const runtimeAllow = normalisePrefixList(runtimeContent.allow ?? []);

  const manualFromAppConfig = normalisePrefixList(
    nuxt.options.appConfig?.content?.manualIgnoredPrefixes ??
      nuxt.options.appConfig?.content?.manualPrefixes ??
      [],
  );

  const mergedRuntimeIgnore = applyAllowOverrides(
    [...runtimeIgnore, ...autoNormalised, ...manualFromAppConfig],
    runtimeAllow,
  );

  nuxt.options.runtimeConfig.content = {
    ...runtimeContent,
    ignore: mergedRuntimeIgnore,
    allow: runtimeAllow,
  };

  nuxt.hook("app:config", (appConfig: any) => {
    appConfig.content = applyContentConfig(appConfig.content);
  });
}
