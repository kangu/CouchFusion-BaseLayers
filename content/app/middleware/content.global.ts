import {
  defineNuxtRouteMiddleware,
  createError,
  abortNavigation,
  navigateTo,
  useCookie,
  useRequestEvent,
  useRuntimeConfig,
} from "#imports";
import { useContentPagesStore } from "#content/app/stores/pages";
import { resolveContentRoutePath } from "#content/utils/page";
import {
  resolveAllowedPrefixes,
  resolveIgnoredPrefixes,
  isContentRoute,
} from "#content/utils/content-route";
import {
  buildLocalizedPath,
  normalizeLocaleCode,
  resolveContentI18nConfig,
  resolveContentLocalePath,
} from "#content/utils/i18n";
import {
  buildContentRouteAccessCookieName,
  canResolveContentRouteAccessForPath,
  hasContentRouteAccessSessionCookie,
  isContentRouteAccessEditorPreview,
  parseContentRouteAccessPolicy,
  resolveContentRouteAccessAction,
} from "#content/utils/route-access";

interface RoutePrefixConfig {
  ignoredPrefixes: string[];
  allowedPrefixes: string[];
}

const CRAWLER_UA_PATTERN =
  /(bot|crawler|spider|slurp|bingpreview|facebookexternalhit|linkedinbot|twitterbot|applebot|duckduckbot|baiduspider|yandex|semrushbot|ahrefsbot|mj12bot|whatsapp|whatsappbot)/i;
const LOCALE_REDIRECT_SESSION_COOKIE = "cf_content_locale_redirect_done";

type ParsedLanguage = {
  code: string;
  quality: number;
  order: number;
};

const isCrawlerUserAgent = (userAgent: string | undefined): boolean =>
  typeof userAgent === "string" && CRAWLER_UA_PATTERN.test(userAgent);

const hasLocaleRedirectSessionCookie = (
  cookieHeader: string | undefined,
): boolean =>
  typeof cookieHeader === "string" &&
  /(?:^|;\s*)cf_content_locale_redirect_done=1(?:;|$)/.test(cookieHeader);

const parseAcceptLanguage = (headerValue: string | undefined): string[] => {
  if (!headerValue || !headerValue.trim()) {
    return [];
  }

  const parsed: ParsedLanguage[] = headerValue
    .split(",")
    .map((entry, index) => {
      const [rawCode, ...params] = entry.trim().split(";");
      const code = rawCode.trim().toLowerCase();
      let quality = 1;

      for (const param of params) {
        const [rawKey, rawValue] = param.split("=");
        if (rawKey?.trim().toLowerCase() !== "q") {
          continue;
        }
        const parsedQuality = Number.parseFloat((rawValue ?? "").trim());
        if (Number.isFinite(parsedQuality)) {
          quality = Math.min(1, Math.max(0, parsedQuality));
        }
      }

      return { code, quality, order: index };
    })
    .filter((entry) => entry.code.length > 0 && entry.code !== "*" && entry.quality > 0)
    .sort((left, right) => {
      if (left.quality !== right.quality) {
        return right.quality - left.quality;
      }
      return left.order - right.order;
    });

  const orderedLocales: string[] = [];
  const seen = new Set<string>();

  for (const entry of parsed) {
    const normalized =
      normalizeLocaleCode(entry.code) ??
      normalizeLocaleCode(entry.code.split("-")[0]) ??
      null;
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    orderedLocales.push(normalized);
  }

  return orderedLocales;
};

const resolvePreferredSupportedLocales = (
  acceptLanguageHeader: string | undefined,
  supportedLocales: string[],
): string[] => {
  const supportedSet = new Set(supportedLocales);
  return parseAcceptLanguage(acceptLanguageHeader).filter((locale) =>
    supportedSet.has(locale),
  );
};

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
  const { ignoredPrefixes, allowedPrefixes } = buildRoutePrefixConfig();
  const runtimeConfig = useRuntimeConfig();
  const contentI18nConfig = resolveContentI18nConfig(
    runtimeConfig.content?.i18n ?? runtimeConfig.public?.content?.i18n,
  );
  const serverRequestEvent = import.meta.server ? useRequestEvent() : null;
  const routePath = resolveContentRoutePath(
    to.path,
    to.fullPath,
    serverRequestEvent?.node.req.url,
  );
  const localizedPath = resolveContentLocalePath(routePath, contentI18nConfig);
  const contentPath = localizedPath.basePath;

  if (routePath.startsWith("/api") || contentPath.startsWith("/api")) {
    // API endpoints are reserved for Nitro server routes; return a hard 404 when a page route
    // attempts to handle them so consuming apps don't need per-page guards.
    return abortNavigation(
      createError({
        statusCode: 404,
        statusMessage: "API endpoint not found",
      }),
    );
  }

  const handlesContentRoute = isContentRoute(
    contentPath,
    ignoredPrefixes,
    allowedPrefixes,
  );
  const accessPolicyOnlyRoute = !handlesContentRoute;

  if (
    accessPolicyOnlyRoute &&
    !canResolveContentRouteAccessForPath(contentPath)
  ) {
    return;
  }

  if (import.meta.client && (!from || from.path === to.path)) {
    // Skip duplicate client execution during initial hydration; SSR already fetched the page.
    // Persist a session marker so subsequent visits to default paths don't trigger browser-locale redirect.
    if (contentI18nConfig.enabled) {
      const localeRedirectSessionCookie = useCookie<string | null>(
        LOCALE_REDIRECT_SESSION_COOKIE,
        {
          path: "/",
          sameSite: "lax",
        },
      );
      localeRedirectSessionCookie.value = "1";
    }
    return;
  }

  const store = useContentPagesStore();

  if (
    handlesContentRoute &&
    import.meta.server &&
    contentI18nConfig.enabled &&
    contentI18nConfig.prefixedLocales.length > 0
  ) {
    const defaultPath = buildLocalizedPath(
      contentPath,
      contentI18nConfig.defaultLocale,
      contentI18nConfig,
    );

    // Redirect only when request entered through a non-prefixed/default-locale path.
    if (routePath === defaultPath) {
      const cookieHeader = Array.isArray(serverRequestEvent?.node.req.headers.cookie)
        ? serverRequestEvent?.node.req.headers.cookie[0]
        : serverRequestEvent?.node.req.headers.cookie;
      const localeRedirectAlreadyHandled =
        hasLocaleRedirectSessionCookie(
          typeof cookieHeader === "string" ? cookieHeader : undefined,
        );

      if (!localeRedirectAlreadyHandled) {
        const acceptLanguageHeader = Array.isArray(serverRequestEvent?.node.req.headers["accept-language"])
          ? serverRequestEvent?.node.req.headers["accept-language"][0]
          : serverRequestEvent?.node.req.headers["accept-language"];
        const userAgentHeader = Array.isArray(serverRequestEvent?.node.req.headers["user-agent"])
          ? serverRequestEvent?.node.req.headers["user-agent"][0]
          : serverRequestEvent?.node.req.headers["user-agent"];

        if (!isCrawlerUserAgent(userAgentHeader)) {
          const preferredLocales = resolvePreferredSupportedLocales(
            typeof acceptLanguageHeader === "string" ? acceptLanguageHeader : undefined,
            contentI18nConfig.locales,
          );

          for (const preferredLocale of preferredLocales) {
            if (preferredLocale === contentI18nConfig.defaultLocale) {
              continue;
            }

            try {
              const localizedSummary = await store.fetchPage(contentPath, false, {
                locale: preferredLocale,
              });

              if (!localizedSummary?.localization?.hasLocaleDocument) {
                continue;
              }

              const targetPath = buildLocalizedPath(
                contentPath,
                preferredLocale,
                contentI18nConfig,
              );
              if (targetPath !== routePath) {
                return navigateTo(targetPath, { redirectCode: 307 });
              }
              break;
            } catch (error: any) {
              if (error?.statusCode === 404) {
                continue;
              }
              console.warn(
                `[content-layer] Locale redirect check failed for ${preferredLocale}:`,
                error instanceof Error ? error.message : String(error),
              );
            }
          }
        }
      }
    }
  }

  try {
    await store.fetchPage(contentPath, false, { locale: localizedPath.locale });
  } catch (error: any) {
    if (error?.statusCode === 404) {
      if (accessPolicyOnlyRoute || import.meta.client) {
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

  // The authenticated /builder and /k editors render the public page in an
  // iframe carrying this marker. Route-access policies must remain editable,
  // including when a persisted policy is invalid and would otherwise fail closed.
  if (isContentRouteAccessEditorPreview(to.query)) {
    return;
  }

  const summary = store.getPage(contentPath, localizedPath.locale);
  const routeAccess = parseContentRouteAccessPolicy(
    summary?.document?.meta ?? summary?.meta,
    contentPath,
  );

  if (routeAccess.status === "invalid") {
    console.warn(
      `[content-layer] Invalid route access policy for ${contentPath}: ${routeAccess.reason}`,
    );
    return abortNavigation(
      createError({
        statusCode: 404,
        statusMessage: "Content page route access is misconfigured",
      }),
    );
  }

  if (routeAccess.status === "valid") {
    const localizedTargetPath = buildLocalizedPath(
      contentPath,
      localizedPath.locale,
      contentI18nConfig,
    );
    const accessCookieName = buildContentRouteAccessCookieName(
      contentPath,
      routeAccess.policy,
    );
    const accessCookie = useCookie<string | null>(
      accessCookieName,
      {
        path: localizedTargetPath,
        sameSite: "lax",
      },
    );
    const fromPath = from?.path
      ? resolveContentLocalePath(from.path, contentI18nConfig).basePath
      : null;
    const rawServerCookieHeader = serverRequestEvent?.node.req.headers.cookie;
    const serverCookieHeader = Array.isArray(rawServerCookieHeader)
      ? rawServerCookieHeader[0]
      : rawServerCookieHeader;
    const hasSession = import.meta.server
      ? hasContentRouteAccessSessionCookie(
          serverCookieHeader,
          accessCookieName,
        )
      : accessCookie.value === "1";
    const action = resolveContentRouteAccessAction({
      policy: routeAccess.policy,
      fromPath,
      hasSession,
    });
    if (action.type === "redirect") {
      const localizedRedirectPath = buildLocalizedPath(
        action.to,
        localizedPath.locale,
        contentI18nConfig,
      );
      return navigateTo(localizedRedirectPath, { redirectCode: 302 });
    }

    if (action.grantSession) {
      accessCookie.value = "1";
    }
  }
});
