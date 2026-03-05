import {
  defineNuxtRouteMiddleware,
  createError,
  abortNavigation,
  useRuntimeConfig,
} from "#imports";
import { useContentPagesStore } from "#content/app/stores/pages";
import {
  resolveAllowedPrefixes,
  resolveIgnoredPrefixes,
  isContentRoute,
} from "#content/utils/content-route";
import {
  resolveContentI18nConfig,
  resolveContentLocalePath,
} from "#content/utils/i18n";

interface RoutePrefixConfig {
  ignoredPrefixes: string[];
  allowedPrefixes: string[];
}

const buildRoutePrefixConfig = (): RoutePrefixConfig => {
  const runtimeConfig = useRuntimeConfig();
  const contentConfig =
    runtimeConfig.content ?? runtimeConfig.public?.content ?? {};

  const runtimeIgnore = Array.isArray(contentConfig.ignore)
    ? contentConfig.ignore
    : [];

  const runtimeAllow = Array.isArray(contentConfig.allow)
    ? contentConfig.allow
    : [];

  return {
    ignoredPrefixes: resolveIgnoredPrefixes({
      ignore: runtimeIgnore,
      allow: runtimeAllow,
    }),
    allowedPrefixes: resolveAllowedPrefixes({
      allow: runtimeAllow,
    }),
  };
};

export default defineNuxtRouteMiddleware(async (to, from) => {
  if (import.meta.client && (!from || from.path === to.path)) {
    // Skip duplicate client execution during initial hydration; SSR already fetched the page.
    return;
  }

  const { ignoredPrefixes, allowedPrefixes } = buildRoutePrefixConfig();
  const runtimeConfig = useRuntimeConfig();
  const contentI18nConfig = resolveContentI18nConfig(
    runtimeConfig.content?.i18n ?? runtimeConfig.public?.content?.i18n,
  );
  const localizedPath = resolveContentLocalePath(to.path, contentI18nConfig);
  const contentPath = localizedPath.basePath;

  if (to.path.startsWith("/api") || contentPath.startsWith("/api")) {
    // API endpoints are reserved for Nitro server routes; return a hard 404 when a page route
    // attempts to handle them so consuming apps don't need per-page guards.
    return abortNavigation(
      createError({
        statusCode: 404,
        statusMessage: "API endpoint not found",
      }),
    );
  }

  if (!isContentRoute(contentPath, ignoredPrefixes, allowedPrefixes)) {
    return;
  }

  const store = useContentPagesStore();

  try {
    await store.fetchPage(contentPath, false, { locale: localizedPath.locale });
  } catch (error: any) {
    if (error?.statusCode === 404) {
      if (import.meta.client) {
        // On client navigation, allow the normal route handling to continue for ignored or non-content pages.
        return;
      }

      console.warn("Content page not found, triggering 404:", contentPath);
      return abortNavigation(
        createError({
          statusCode: 404,
          statusMessage: "Content page not found",
        }),
      );
    }

    console.error("Content middleware fetch error:", error);
  }
});
