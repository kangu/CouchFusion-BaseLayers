import { createError, type H3Event } from "h3";
import { requireAuthenticatedUser } from "#auth/server/utils/authenticated-user";

export const assertMaintenanceRole = async (
  event: H3Event,
  allowedRoles: string[] = ["admin"],
): Promise<{ username: string; roles: string[] }> => {
  const context = await requireAuthenticatedUser(event);
  const roles = Array.isArray(context.session.userCtx.roles)
    ? context.session.userCtx.roles
    : [];

  const effectiveRoles = allowedRoles.length ? allowedRoles : ["admin"];
  const hasRole = effectiveRoles.some((role) => roles.includes(role));

  if (!hasRole) {
    throw createError({
      statusCode: 403,
      statusMessage: "Access denied",
    });
  }

  return {
    username: context.session.userCtx.name,
    roles,
  };
};
