/**
 * Access control for analytics read/admin APIs, based on the CouchDB session.
 * `admin` (or `_admin`) sees everything; other users see sites whose
 * `allowedRoles` intersect their roles. Denials are 404, like the auth layer.
 */
import { createError, getHeader, type H3Event } from "h3";
import { getSession } from "#database/utils/couchdb";
import type { SiteDoc } from "./types";

export interface AnalyticsUser {
  name: string | null;
  roles: string[];
  isAdmin: boolean;
}

const sessionCookie = (event: H3Event): string | null => {
  const header = getHeader(event, "cookie");
  if (!header) return null;
  for (const segment of header.split(";")) {
    const [key, ...rest] = segment.trim().split("=");
    if (key === "AuthSession") return rest.join("=") || null;
  }
  return null;
};

export const notFound = () => createError({ statusCode: 404, statusMessage: "Not found" });

/** Resolves the logged-in CouchDB user, or null. */
export const getAnalyticsUser = async (event: H3Event): Promise<AnalyticsUser | null> => {
  if (event.context.analyticsUser !== undefined) return event.context.analyticsUser;
  const token = sessionCookie(event);
  let user: AnalyticsUser | null = null;
  if (token) {
    const session = await getSession({ authSessionCookie: token });
    const ctx = session?.userCtx;
    if (ctx?.name || ctx?.roles?.length) {
      const roles = Array.isArray(ctx.roles) ? ctx.roles : [];
      user = { name: ctx.name ?? null, roles, isAdmin: roles.includes("admin") || roles.includes("_admin") };
    }
  }
  event.context.analyticsUser = user;
  return user;
};

export const canReadSite = (user: AnalyticsUser | null, site: SiteDoc): boolean => {
  if (!user) return false;
  if (user.isAdmin) return true;
  return site.allowedRoles.some((role) => user.roles.includes(role));
};

/** Requires any logged-in user with admin or at least one analytics-capable role. */
export const requireUser = async (event: H3Event): Promise<AnalyticsUser> => {
  const user = await getAnalyticsUser(event);
  if (!user) throw notFound();
  return user;
};

export const requireAdmin = async (event: H3Event): Promise<AnalyticsUser> => {
  const user = await getAnalyticsUser(event);
  if (!user?.isAdmin) throw notFound();
  return user;
};
