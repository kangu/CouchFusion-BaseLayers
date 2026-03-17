import {
  createError,
  defineEventHandler,
  getRouterParam,
} from "h3";
import { getDocument, deleteDocument } from "#database/utils/couchdb";
import { assertMaintenanceRole } from "../../../utils/assert-maintenance-role";

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

  await deleteDocument("_users", docId, existingUser._rev);

  return {
    success: true,
  };
});