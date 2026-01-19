import { assertAdminSession } from "#auth/server/utils/assert-admin-session";

interface SyncDocPayload {
  host: string;
  username: string;
  password: string;
  dbName: string;
  docId: string;
  mode: "safe" | "force";
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

const fetchDoc = async (
  baseUrl: string,
  authHeader: string,
  dbName: string,
  docId: string,
) => {
  const response = await fetch(
    `${baseUrl}/${encodeURIComponent(dbName)}/${encodeURIComponent(docId)}`,
    {
      headers: {
        Authorization: authHeader,
      },
    },
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const detail = await response.text();
    throw createError({
      statusCode: response.status,
      statusMessage: detail || "Failed to read document.",
    });
  }

  return await response.json();
};

const putDoc = async (
  baseUrl: string,
  authHeader: string,
  dbName: string,
  docId: string,
  payload: Record<string, unknown>,
) => {
  const response = await fetch(
    `${baseUrl}/${encodeURIComponent(dbName)}/${encodeURIComponent(docId)}`,
    {
      method: "PUT",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    const detail = await response.text();
    throw createError({
      statusCode: response.status,
      statusMessage: detail || "Failed to write document.",
    });
  }

  return await response.json();
};

export default defineEventHandler(async (event) => {
  await assertAdminSession(event);

  const runtimeConfig = useRuntimeConfig();
  const localCouchUrl =
    typeof runtimeConfig.couchUrl === "string"
      ? runtimeConfig.couchUrl.replace(/\/+$/, "")
      : "";
  const localAdminAuth = process.env.COUCHDB_ADMIN_AUTH;

  const body = (await readBody(event)) as SyncDocPayload | null;

  if (!body) {
    throw createError({ statusCode: 400, statusMessage: "Missing request body." });
  }

  const host = typeof body.host === "string" ? body.host : "";
  const username = typeof body.username === "string" ? body.username : "";
  const password = typeof body.password === "string" ? body.password : "";
  const dbName = typeof body.dbName === "string" ? body.dbName : "";
  const docId = typeof body.docId === "string" ? body.docId : "";
  const mode = body.mode === "force" ? "force" : "safe";

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

  if (!dbName || !docId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Database name and document id are required.",
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

  const sourceDoc = await fetchDoc(
    normalizedHost,
    remoteAuthHeader,
    dbName,
    docId,
  );

  if (!sourceDoc) {
    throw createError({
      statusCode: 404,
      statusMessage: "Remote document not found.",
    });
  }

  const targetDoc = await fetchDoc(
    localCouchUrl,
    localAuthHeader,
    dbName,
    docId,
  );

  if (!targetDoc) {
    const payload = { ...sourceDoc } as Record<string, unknown>;
    delete payload._rev;
    const result = await putDoc(
      localCouchUrl,
      localAuthHeader,
      dbName,
      docId,
      payload,
    );
    return {
      status: "created",
      result,
    };
  }

  const sourceRev = sourceDoc._rev;
  const targetRev = targetDoc._rev;

  if (mode === "safe" && sourceRev !== targetRev) {
    throw createError({
      statusCode: 409,
      statusMessage: "Conflict detected.",
      data: {
        sourceRev,
        targetRev,
      },
    });
  }

  const payload = { ...sourceDoc, _rev: targetRev } as Record<string, unknown>;
  const result = await putDoc(
    localCouchUrl,
    localAuthHeader,
    dbName,
    docId,
    payload,
  );

  return {
    status: mode === "force" ? "overwritten" : "synced",
    result,
  };
});
