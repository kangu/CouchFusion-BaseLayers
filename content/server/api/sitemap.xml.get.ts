import {
  defineEventHandler,
  setResponseHeader,
  createError,
  getHeader,
} from "h3";
import { useRuntimeConfig, useAppConfig } from "#imports";
import { getView } from "#database/utils/couchdb";
import { getContentDatabaseName } from "../utils/database";
import { normalizePagePath } from "#content/utils/page";
import {
  resolveIgnoredPrefixes,
  isContentRoute,
} from "#content/utils/content-route";

type SitemapEntry = {
  path: string;
  updatedAt: string | null;
};

const escapeXml = (value: string): string => {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
};

const toIsoDate = (value: string | null): string | null => {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
};

const loadStaticRoutes = (runtimeConfig: any): string[] => {
  const configured = Array.isArray(
    runtimeConfig?.content?.sitemap?.staticRoutes,
  )
    ? runtimeConfig.content.sitemap.staticRoutes
    : [];

  return configured;
};

const loadContentRoutes = async (
  ignoredPrefixes: string[],
): Promise<SitemapEntry[]> => {
  const databaseName = getContentDatabaseName();
  const viewResult = await getView(databaseName, "content", "by_path", {
    include_docs: true,
  });

  const rows = Array.isArray(viewResult?.rows) ? viewResult.rows : [];

  return rows.reduce<SitemapEntry[]>((acc, row: any) => {
    const rawDoc: Record<string, any> | undefined = row?.doc;
    const rawPath =
      typeof row?.key === "string"
        ? row.key
        : rawDoc?._id
          ? rawDoc._id.replace(/^page-/, "")
          : null;

    if (!rawPath) {
      return acc;
    }

    const normalizedPath = normalizePagePath(rawPath);

    if (!isContentRoute(normalizedPath, ignoredPrefixes)) {
      return acc;
    }

    const navigationEnabled =
      typeof rawDoc?.navigation === "boolean" ? rawDoc.navigation : true;
    if (!navigationEnabled) {
      return acc;
    }

    const meta =
      rawDoc?.meta && typeof rawDoc.meta === "object"
        ? rawDoc.meta
        : rawDoc?.metadata && typeof rawDoc.metadata === "object"
          ? rawDoc.metadata
          : {};

    if (meta?.sitemap?.exclude === true) {
      return acc;
    }

    const updatedAt =
      rawDoc?.updatedAt ?? rawDoc?.updated_at ?? row?.value?.updatedAt ?? null;

    acc.push({
      path: normalizedPath,
      updatedAt: typeof updatedAt === "string" ? updatedAt : null,
    });

    return acc;
  }, []);
};

const parseExtraRoutes = (value: any): SitemapEntry[] => {
  if (!value) {
    return [];
  }

  const entries: SitemapEntry[] = [];

  const pushRoute = (pathValue: any, lastmodValue: any) => {
    if (typeof pathValue !== "string") {
      return;
    }

    entries.push({
      path: normalizePagePath(pathValue),
      updatedAt: typeof lastmodValue === "string" ? lastmodValue : null,
    });
  };

  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item === "string") {
        pushRoute(item, null);
        continue;
      }

      if (item && typeof item === "object") {
        pushRoute(
          item.path ?? item.route,
          item.lastmod ?? item.updatedAt ?? null,
        );
      }
    }
  } else if (typeof value === "object" && typeof value.path === "string") {
    pushRoute(value.path, value.lastmod ?? value.updatedAt ?? null);
  }

  return entries;
};

const resolveSiteOrigin = (event: any, runtimeConfig: any): string => {
  const configured =
    runtimeConfig?.public?.siteUrl ||
    runtimeConfig?.public?.siteURL ||
    runtimeConfig?.siteUrl;

  if (typeof configured === "string" && configured.trim().length > 0) {
    return configured.trim().replace(/\/+$/, "");
  }

  const forwardedProto = getHeader(event, "x-forwarded-proto") || "https";
  const forwardedHost = getHeader(event, "x-forwarded-host");
  const host = forwardedHost || getHeader(event, "host") || "localhost";

  return `${forwardedProto}://${host}`.replace(/\/+$/, "");
};

const buildSitemapXml = (origin: string, entries: SitemapEntry[]): string => {
  const items = entries
    .map((entry) => {
      const trimmedOrigin = origin.replace(/\/+$/, "");
      const loc =
        entry.path === "/"
          ? `${trimmedOrigin}/`
          : `${trimmedOrigin}${entry.path}`;
      const lastmod = toIsoDate(entry.updatedAt);

      const segments = [`  <url>`, `    <loc>${escapeXml(loc)}</loc>`];

      if (lastmod) {
        segments.push(`    <lastmod>${escapeXml(lastmod)}</lastmod>`);
      }

      segments.push(`  </url>`);

      return segments.join("\n");
    })
    .join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    items,
    "</urlset>",
  ].join("\n");
};

export default defineEventHandler(async (event) => {
  try {
    const runtimeConfig = useRuntimeConfig();
    const appConfig = useAppConfig();
    console.log("Resolving ignored:", appConfig?.content);
    const ignoredPrefixes = resolveIgnoredPrefixes(appConfig?.content);
    console.log("Final resolved ignored:", ignoredPrefixes);

    const entriesMap = new Map<string, SitemapEntry>();

    const staticRoutes = loadStaticRoutes(runtimeConfig);
    for (const route of staticRoutes) {
      if (typeof route !== "string") {
        continue;
      }

      const normalizedPath = normalizePagePath(route);
      console.log(
        "Checking static route",
        normalizedPath,
        isContentRoute(normalizedPath, ignoredPrefixes),
      );
      if (!isContentRoute(normalizedPath, ignoredPrefixes)) {
        continue;
      }

      entriesMap.set(normalizedPath, {
        path: normalizedPath,
        updatedAt: null,
      });
    }

    const extraRoutes = parseExtraRoutes(
      appConfig?.content?.sitemapExtraRoutes,
    );
    for (const entry of extraRoutes) {
      if (!isContentRoute(entry.path, ignoredPrefixes)) {
        continue;
      }

      const existing = entriesMap.get(entry.path);
      if (existing && existing.updatedAt) {
        continue;
      }

      entriesMap.set(entry.path, {
        path: entry.path,
        updatedAt: entry.updatedAt ?? existing?.updatedAt ?? null,
      });
    }

    const contentRoutes = await loadContentRoutes(ignoredPrefixes);
    for (const entry of contentRoutes) {
      if (!isContentRoute(entry.path, ignoredPrefixes)) {
        continue;
      }

      const existing = entriesMap.get(entry.path);
      if (!existing) {
        entriesMap.set(entry.path, entry);
        continue;
      }

      const existingDate = existing.updatedAt
        ? new Date(existing.updatedAt)
        : null;
      const incomingDate = entry.updatedAt ? new Date(entry.updatedAt) : null;

      if (!existingDate || (incomingDate && incomingDate > existingDate)) {
        entriesMap.set(entry.path, entry);
      }
    }

    const origin = resolveSiteOrigin(event, runtimeConfig);
    const finalEntries = Array.from(entriesMap.values()).sort((a, b) =>
      a.path.localeCompare(b.path),
    );

    setResponseHeader(event, "Content-Type", "application/xml; charset=utf-8");
    setResponseHeader(
      event,
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate",
    );
    setResponseHeader(event, "Pragma", "no-cache");
    setResponseHeader(event, "Expires", "0");

    return buildSitemapXml(origin, finalEntries);
  } catch (error) {
    console.error("Content layer sitemap generation failed:", error);
    throw createError({
      statusCode: 500,
      statusMessage: "Failed to generate sitemap",
    });
  }
});
