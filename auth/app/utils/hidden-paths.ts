/**
 * Admin areas that don't advertise themselves: on pages that use the `auth` middleware, a
 * signed-out visitor under one of these prefixes gets the site's 404 instead of a redirect
 * to the login page. Configured as a comma-separated string (`public.authHiddenPaths`,
 * `NUXT_PUBLIC_AUTH_HIDDEN_PATHS`) so an app can replace or empty it; Nuxt concatenates
 * arrays across layers, which would make an array impossible to shrink.
 */
export const DEFAULT_AUTH_HIDDEN_PATHS = "/admin,/builder,/k";

/** Normalized prefixes (lower case, no trailing slash); `/` alone is ignored. */
export const parseAuthHiddenPaths = (value: unknown): string[] =>
  (Array.isArray(value) ? value : String(value ?? "").split(","))
    .map((entry) => String(entry).trim().toLowerCase().replace(/\/+$/, ""))
    .filter((entry) => entry.startsWith("/") && entry.length > 1);

/**
 * True when `path` is a prefix or below it, by whole segments: `/admin` and `/admin/x`
 * match, `/administrator` and `/admin-not-here` don't. Case, percent-encoding, repeated and
 * trailing slashes are ignored, as the router ignores them when matching routes.
 */
export const isAuthHiddenPath = (path: string, prefixes: string[]): boolean => {
  let normalized = path;
  try {
    normalized = decodeURIComponent(path);
  } catch {
    // Malformed encoding: compare the raw path.
  }
  normalized = normalized.toLowerCase().replace(/\/{2,}/g, "/").replace(/\/+$/, "") || "/";
  return prefixes.some((prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`));
};
