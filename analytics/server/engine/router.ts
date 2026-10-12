/**
 * Minimal path router used by the catch-all analytics API handlers.
 */
import { createError, getMethod, getQuery, readBody, type H3Event } from "h3";
import { QueryError } from "./query";

export interface RouteContext {
  event: H3Event;
  params: Record<string, string>;
  query: Record<string, any>;
  body: any;
}

export interface Route<C> {
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  handler: (ctx: RouteContext & C) => Promise<any> | any;
}

const matchPath = (pattern: string, path: string): Record<string, string> | null => {
  const a = pattern.split("/").filter(Boolean);
  const b = path.split("/").filter(Boolean);
  if (a.length !== b.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < a.length; i += 1) {
    if (a[i].startsWith(":")) params[a[i].slice(1)] = decodeURIComponent(b[i]);
    else if (a[i] !== b[i]) return null;
  }
  return params;
};

/** Dispatches `path` to the first matching route. */
export const dispatch = async <C>(
  event: H3Event,
  path: string,
  routes: Route<C>[],
  buildContext: (ctx: RouteContext, route: Route<C>) => Promise<C> | C,
) => {
  const method = getMethod(event);
  for (const route of routes) {
    if (route.method !== method) continue;
    const params = matchPath(route.path, path);
    if (!params) continue;
    const body = method === "POST" || method === "PUT" ? await readBody(event).catch(() => ({})) : undefined;
    const base: RouteContext = { event, params, query: getQuery(event), body: body ?? {} };
    try {
      const extra = await buildContext(base, route);
      return await route.handler({ ...base, ...extra });
    } catch (error: any) {
      if (error instanceof QueryError) throw createError({ statusCode: error.statusCode, statusMessage: error.message });
      if (error?.statusCode) throw error;
      if (error instanceof Error && /^(Site id|Invalid|Unknown)/.test(error.message)) {
        throw createError({ statusCode: 400, statusMessage: error.message });
      }
      console.error(`[analytics] ${method} ${path} failed:`, error);
      throw createError({ statusCode: 500, statusMessage: "Analytics request failed" });
    }
  }
  throw createError({ statusCode: 404, statusMessage: "Not found" });
};
