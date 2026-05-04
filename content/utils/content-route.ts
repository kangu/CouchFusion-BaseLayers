export const RESERVED_CONTENT_PREFIXES = [
  "/.well-known",
  "/_nuxt",
  "/api",
  "/assets",
  "/favicon",
  "/login",
  "/admin",
  "/builder",
  "/k",
  "/__",
] as const;

export const normaliseContentPrefix = (
  value: string | null | undefined,
): string | null => {
  if (typeof value !== "string") {
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

const normalisePrefixList = (input: any): string[] => {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((prefix) => normaliseContentPrefix(prefix))
    .filter((value): value is string => Boolean(value));
};

/**
 * Route-prefix matcher where `/` is treated as exact-only.
 */
const matchesRoutePrefix = (path: string, prefix: string): boolean => {
  if (prefix === "/") {
    return path === "/";
  }

  return path.startsWith(prefix);
};

export interface ResolveIgnoredPrefixesOptions {
  includeAuto?: boolean;
  includeManual?: boolean;
  includeMerged?: boolean;
}

export interface ResolveAllowedPrefixesOptions {
  includeRuntimeAllow?: boolean;
  includeConfiguredAllow?: boolean;
}

export const resolveAllowedPrefixes = (
  appConfigContent: Record<string, any> | undefined | null,
  options: ResolveAllowedPrefixesOptions = {},
): string[] => {
  const { includeRuntimeAllow = true, includeConfiguredAllow = true } = options;

  const combined = new Set<string>();

  if (includeRuntimeAllow) {
    const runtimeAllowed = normalisePrefixList(appConfigContent?.allow ?? []);
    for (const prefix of runtimeAllowed) {
      combined.add(prefix);
    }
  }

  if (includeConfiguredAllow) {
    const configuredAllowed = normalisePrefixList(
      appConfigContent?.allowedPrefixes ?? [],
    );
    for (const prefix of configuredAllowed) {
      combined.add(prefix);
    }
  }

  return Array.from(combined).sort((a, b) => a.localeCompare(b));
};

export const resolveIgnoredPrefixes = (
  appConfigContent: Record<string, any> | undefined | null,
  options: ResolveIgnoredPrefixesOptions = {},
): string[] => {
  const {
    includeAuto = true,
    includeManual = true,
    includeMerged = true,
  } = options;

  const combined = new Set<string>(RESERVED_CONTENT_PREFIXES);

  const runtimeIgnored = normalisePrefixList(appConfigContent?.ignore ?? []);
  for (const prefix of runtimeIgnored) {
    combined.add(prefix);
  }

  if (includeManual) {
    const manual = normalisePrefixList(
      appConfigContent?.manualIgnoredPrefixes ??
        appConfigContent?.manualPrefixes ??
        [],
    );

    for (const prefix of manual) {
      combined.add(prefix);
    }
  }

  if (includeAuto) {
    const auto = normalisePrefixList(
      appConfigContent?.autoIgnoredPrefixes ?? [],
    );
    for (const prefix of auto) {
      combined.add(prefix);
    }
  }

  if (includeMerged) {
    const merged = normalisePrefixList(appConfigContent?.ignoredPrefixes ?? []);
    for (const prefix of merged) {
      combined.add(prefix);
    }
  }

  const allowed = resolveAllowedPrefixes(appConfigContent);

  return Array.from(combined)
    .filter((ignoredPrefix) => {
      if ((RESERVED_CONTENT_PREFIXES as readonly string[]).includes(ignoredPrefix)) {
        return true;
      }

      return !allowed.some((allowedPrefix) =>
        matchesRoutePrefix(ignoredPrefix, allowedPrefix),
      );
    })
    .sort((a, b) => a.localeCompare(b));
};

export const isContentRoute = (
  path: string,
  ignoredPrefixes: string[],
  allowedPrefixes: string[] = [],
): boolean => {
  if (!path || !path.startsWith("/")) {
    return false;
  }

  if (path.includes("?") || path.includes("#")) {
    return false;
  }

  if (path !== "/") {
    const lastSegment = path.split("/").pop() ?? "";
    if (!lastSegment || lastSegment.includes(".")) {
      return false;
    }
  }

  if (
    RESERVED_CONTENT_PREFIXES.some((prefix) => matchesRoutePrefix(path, prefix))
  ) {
    return false;
  }

  if (allowedPrefixes.some((prefix) => matchesRoutePrefix(path, prefix))) {
    return true;
  }

  if (ignoredPrefixes.some((prefix) => matchesRoutePrefix(path, prefix))) {
    return false;
  }

  return true;
};
