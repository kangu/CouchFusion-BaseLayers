/**
 * Fetch helpers bound to an analytics API base (admin or public share).
 */
export interface AnalyticsApi {
  base: string;
  readonly: boolean;
  get: <T = any>(path: string, query?: Record<string, any>) => Promise<T>;
  post: <T = any>(path: string, body?: Record<string, any>) => Promise<T>;
  put: <T = any>(path: string, body?: Record<string, any>) => Promise<T>;
  del: <T = any>(path: string) => Promise<T>;
  url: (path: string, query?: Record<string, any>) => string;
}

const clean = (query: Record<string, any> = {}) =>
  Object.fromEntries(Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== ""));

/**
 * @param base e.g. `/api/analytics/admin` or `/api/analytics/share/<token>`
 * @param readonly hides mutating UI when true (share pages)
 */
export const createAnalyticsApi = (base: string, readonly = false): AnalyticsApi => ({
  base,
  readonly,
  get: (path, query) => $fetch(`${base}/${path}`, { query: clean(query) }) as any,
  post: (path, body) => $fetch(`${base}/${path}`, { method: "POST", body: body ?? {} }) as any,
  put: (path, body) => $fetch(`${base}/${path}`, { method: "PUT", body: body ?? {} }) as any,
  del: (path) => $fetch(`${base}/${path}`, { method: "DELETE" }) as any,
  url: (path, query) => {
    const params = new URLSearchParams(clean(query) as Record<string, string>).toString();
    return `${base}/${path}${params ? `?${params}` : ""}`;
  },
});

/** Extracts a readable message from a $fetch error. */
export const errorMessage = (error: any): string =>
  error?.data?.statusMessage || error?.statusMessage || error?.data?.message || error?.message || "Request failed";
