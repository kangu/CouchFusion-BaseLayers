import { createError, defineEventHandler, readBody } from "h3";
import { createUser } from "#database/utils/couchdb";
import { assertMaintenanceRole } from "../../../utils/assert-maintenance-role";

interface EmployeeCreatePayload {
  username?: unknown;
  email?: unknown;
  password?: unknown;
}

const randomPassword = () => {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

export default defineEventHandler(async (event) => {
  await assertMaintenanceRole(event, ["admin"]);

  const config = useRuntimeConfig();
  const dbLoginPrefix = config.dbLoginPrefix;

  const payload = await readBody<EmployeeCreatePayload>(event);
  if (!payload || typeof payload !== "object") {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid payload",
    });
  }

  const username = payload.username;
  const email = payload.email;
  const password = payload.password || randomPassword();

  if (!username || typeof username !== "string" || username.trim().length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: "Username is required",
    });
  }

  const usernameStr = username.trim();
  const fullUsername = `${dbLoginPrefix}${usernameStr}`;

  await createUser(fullUsername, password, { email: typeof email === "string" ? email.trim() : null }, ["employee"]);

  return {
    success: true,
    user: {
      name: fullUsername,
      email: typeof email === "string" ? email.trim() : null,
      roles: ["employee"],
    },
  };
});