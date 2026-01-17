import { assertAdminSession } from "#auth/server/utils/assert-admin-session";

interface DbInfoPayload {
  host: string;
  username: string;
  password: string;
}

interface DbInfoResponse {
  instance_start_time?: string;
  db_name?: string;
  update_seq?: string;
  sizes?: {
    file?: number;
    external?: number;
    active?: number;
  };
  doc_count?: number;
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

const fetchDbInfo = async (
  baseUrl: string,
  authHeader: string,
  dbName: string,
): Promise<DbInfoResponse | null> => {
  const response = await fetch(`${baseUrl}/${encodeURIComponent(dbName)}`, {
    headers: {
      Authorization: authHeader,
    },
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const detail = await response.text();
    throw createError({
      statusCode: response.status,
      statusMessage: detail || "Remote CouchDB request failed.",
    });
  }

  return (await response.json()) as DbInfoResponse;
};

export default defineEventHandler(async (event) => {
  await assertAdminSession(event);

  const runtimeConfig = useRuntimeConfig();
  const localCouchUrl =
    typeof runtimeConfig.couchUrl === "string"
      ? runtimeConfig.couchUrl.replace(/\/+$/, "")
      : "";
  const localAdminAuth = process.env.COUCHDB_ADMIN_AUTH;

  const dbName = getRouterParam(event, "db_name");
  if (!dbName) {
    throw createError({ statusCode: 400, statusMessage: "Database name missing." });
  }

  const body = (await readBody(event)) as DbInfoPayload | null;

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

  if (!localCouchUrl || !localAdminAuth) {
    throw createError({
      statusCode: 500,
      statusMessage: "Local CouchDB configuration missing.",
    });
  }

  const remoteAuthHeader = `Basic ${Buffer.from(
    `${username}:${password}`,
  ).toString("base64")}`;
  const localAuthHeader = `Basic ${localAdminAuth}`;

  const [remoteInfo, localInfo] = await Promise.all([
    fetchDbInfo(normalizedHost, remoteAuthHeader, dbName),
    fetchDbInfo(localCouchUrl, localAuthHeader, dbName),
  ]);

  return {
    remote: remoteInfo,
    local: localInfo,
  };
});
