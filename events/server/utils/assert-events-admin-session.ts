import { createError, type H3Event } from "h3";
import { requireAuthenticatedUser } from "#auth/server/utils/authenticated-user";

/**
 * Enforce role-based access for events admin APIs.
 * Defaults to admin-only when no roles are provided.
 */
export const assertEventsAdminSession = async (
  event: H3Event,
  allowedRoles: string[] = ["admin"],
): Promise<void> => {
  const userContext = await requireAuthenticatedUser(event);
  const sessionRoles = Array.isArray(userContext.session.userCtx.roles)
    ? userContext.session.userCtx.roles
    : [];
  const effectiveRoles = Array.isArray(allowedRoles) && allowedRoles.length
    ? allowedRoles
    : ["admin"];
  const hasAccess = effectiveRoles.some((role) => sessionRoles.includes(role));

  if (!hasAccess) {
    throw createError({
      statusCode: 404,
      statusMessage: "Not found",
    });
  }
};
