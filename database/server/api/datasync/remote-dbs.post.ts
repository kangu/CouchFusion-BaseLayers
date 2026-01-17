import { assertAdminSession } from "#auth/server/utils/assert-admin-session";

interface RemoteDbsPayload {
  host: string;
  username: string;
  password: string;
}

const normalizeHost = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  if (trimmed.startsWith("http://")) {
    return "";
  }

  if (trimmed.startsWith("https://")) {
    return trimmed.replace(/\/+$/, "");
  }

  return `https://${trimmed}`.replace(/\/+$/, "");
};

export default defineEventHandler(async (event) => {
  await assertAdminSession(event);

  const body = (await readBody(event)) as RemoteDbsPayload | null;

  if (!body) {
    throw createError({ statusCode: 400, statusMessage: "Missing request body." });
  }

  const host = typeof body.host === "string" ? body.host : "";
  const username = typeof body.username === "string" ? body.username : "";
  const password = typeof body.password === "string" ? body.password : "";

  const normalizedHost = normalizeHost(host);

  if (!normalizedHost) {
    throw createError({
      statusCode: 400,
      statusMessage: "Remote host must use https://",
    });
  }

  if (!username || !password) {
    throw createError({
      statusCode: 400,
      statusMessage: "Username and password are required.",
    });
  }

  const authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString(
    "base64",
  )}`;

  const response = await fetch(`${normalizedHost}/_all_dbs`, {
    headers: {
      Authorization: authHeader,
    },
  });

  if (!response.ok) {
    const detail = await response.text();
    throw createError({
      statusCode: response.status,
      statusMessage: detail || "Remote CouchDB request failed.",
    });
  }

  const payload = await response.json();

  if (!Array.isArray(payload)) {
    throw createError({
      statusCode: 502,
      statusMessage: "Unexpected response from remote CouchDB host.",
    });
  }

  return {
    databases: payload,
  };
});
