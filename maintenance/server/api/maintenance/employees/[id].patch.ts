import {
  createError,
  defineEventHandler,
  getRouterParam,
  readBody,
} from "h3";
import { getDocument, putDocument } from "#database/utils/couchdb";
import { assertMaintenanceRole } from "../../../utils/assert-maintenance-role";

interface EmployeePatchPayload {
  email?: unknown;
}

export default defineEventHandler(async (event) => {
  await assertMaintenanceRole(event, ["admin"]);

  const config = useRuntimeConfig();
  const dbLoginPrefix = config.dbLoginPrefix;

  const username = getRouterParam(event, "id", { decode: true });
  if (!username) {
    throw createError({
      statusCode: 400,
      statusMessage: "Username is required",
    });
  }

  const fullUsername = `${dbLoginPrefix}${username}`;

  const payload = await readBody<EmployeePatchPayload>(event);
  if (!payload || typeof payload !== "object") {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid payload",
    });
  }

  const docId = `org.couchdb.user:${fullUsername}`;
  const existingUser = await getDocument("_users", docId);

  if (!existingUser) {
    throw createError({
      statusCode: 404,
      statusMessage: "Employee not found",
    });
  }

  const roles = Array.isArray(existingUser.roles) ? existingUser.roles : [];
  if (!roles.includes("employee")) {
    throw createError({
      statusCode: 400,
      statusMessage: "User is not an employee",
    });
  }

  const updatedUser = {
    ...existingUser,
    email: typeof payload.email === "string" ? payload.email.trim() : existingUser.email,
  };

  const result = await putDocument("_users", updatedUser);

  return {
    success: true,
    user: {
      name: fullUsername,
      email: updatedUser.email,
      roles: updatedUser.roles,
    },
  };
});