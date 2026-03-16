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

const matchesManagedDbName = (name: string, dbLoginPrefix: string): boolean => {
  if (name === "_users") {
    return true;
  }

  // Use an extra "-" to account for staging names and avoid prefix collisions.
  return dbLoginPrefix ? name.startsWith(`${dbLoginPrefix}-`) : false;
};

export default defineEventHandler(async (event) => {
  await assertAdminSession(event);

  const runtimeConfig = useRuntimeConfig();
  const localCouchUrl =
    typeof runtimeConfig.couchUrl === "string"
      ? runtimeConfig.couchUrl.replace(/\/+$/, "")
      : "";
  const localAdminAuth = process.env.COUCHDB_ADMIN_AUTH;
  const dbLoginPrefix =
    typeof runtimeConfig.dbLoginPrefix === "string"
      ? runtimeConfig.dbLoginPrefix
      : "";

  const body = (await readBody(event)) as RemoteDbsPayload | null;

  if (!body) {
    throw createError({
      statusCode: 400,
      statusMessage: "Missing request body.",
    });
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

  const remoteResponse = await fetch(`${normalizedHost}/_all_dbs`, {
    headers: {
      Authorization: authHeader,
    },
  });

  if (!remoteResponse.ok) {
    const detail = await remoteResponse.text();
    throw createError({
      statusCode: remoteResponse.status,
      statusMessage: detail || "Remote CouchDB request failed.",
    });
  }

  if (!localCouchUrl || !localAdminAuth) {
    throw createError({
      statusCode: 500,
      statusMessage: "Local CouchDB configuration missing.",
    });
  }

  const localResponse = await fetch(`${localCouchUrl}/_all_dbs`, {
    headers: {
      Authorization: `Basic ${localAdminAuth}`,
    },
  });

  if (!localResponse.ok) {
    const detail = await localResponse.text();
    throw createError({
      statusCode: localResponse.status,
      statusMessage: detail || "Local CouchDB request failed.",
    });
  }

  const remotePayload = await remoteResponse.json();
  const localPayload = await localResponse.json();

  if (!Array.isArray(remotePayload) || !Array.isArray(localPayload)) {
    throw createError({
      statusCode: 502,
      statusMessage: "Unexpected response from CouchDB host.",
    });
  }

  const remoteDatabases = remotePayload.filter((name: string) =>
    matchesManagedDbName(name, dbLoginPrefix)
  );
  const localDatabases = localPayload.filter((name: string) =>
    matchesManagedDbName(name, dbLoginPrefix)
  );
  const databases = Array.from(new Set([...remoteDatabases, ...localDatabases]))
    .sort((a, b) => a.localeCompare(b));

  return {
    databases,
    remoteDatabases,
    localDatabases,
  };
});
