import { assertAdminSession } from "#auth/server/utils/assert-admin-session";

interface ReplicatePayload {
  host: string;
  username: string;
  password: string;
  dbName: string;
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

const buildReplicatorId = (dbName: string): string => {
  return `datasync-${dbName}`;
};

export default defineEventHandler(async (event) => {
  await assertAdminSession(event);

  const runtimeConfig = useRuntimeConfig();
  const localCouchUrl =
    typeof runtimeConfig.couchUrl === "string"
      ? runtimeConfig.couchUrl.replace(/\/+$/, "")
      : "";
  const localAdminAuth = process.env.COUCHDB_ADMIN_AUTH;

  const body = (await readBody(event)) as ReplicatePayload | null;

  if (!body) {
    throw createError({ statusCode: 400, statusMessage: "Missing request body." });
  }

  const host = typeof body.host === "string" ? body.host : "";
  const username = typeof body.username === "string" ? body.username : "";
  const password = typeof body.password === "string" ? body.password : "";
  const dbName = typeof body.dbName === "string" ? body.dbName : "";

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

  if (!dbName) {
    throw createError({
      statusCode: 400,
      statusMessage: "Database name is required.",
    });
  }

  if (!localCouchUrl || !localAdminAuth) {
    throw createError({
      statusCode: 500,
      statusMessage: "Local CouchDB configuration missing.",
    });
  }

  const remoteSource = `${normalizedHost}/${encodeURIComponent(dbName)}`;
  const localTarget = `${localCouchUrl}/${encodeURIComponent(dbName)}`;
  const replicatorId = buildReplicatorId(dbName);

  const replicatorDoc = {
    _id: replicatorId,
    source: {
      url: remoteSource,
      headers: {
        Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString(
          "base64",
        )}`,
      },
    },
    target: {
      url: localTarget,
      headers: {
        Authorization: `Basic ${localAdminAuth}`,
      },
    },
    create_target: true,
  };

  const authHeader = `Basic ${localAdminAuth}`;

  const existingResponse = await fetch(
    `${localCouchUrl}/_replicator/${encodeURIComponent(replicatorId)}`,
    {
      headers: {
        Authorization: authHeader,
      },
    },
  );

  if (existingResponse.ok) {
    const existingDoc = await existingResponse.json();
    const updateResponse = await fetch(
      `${localCouchUrl}/_replicator/${encodeURIComponent(replicatorId)}`,
      {
        method: "PUT",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...replicatorDoc,
          _rev: existingDoc._rev,
        }),
      },
    );

    if (!updateResponse.ok) {
      const detail = await updateResponse.text();
      throw createError({
        statusCode: updateResponse.status,
        statusMessage: detail || "Failed to update replication job.",
      });
    }

    return {
      id: replicatorId,
      updated: true,
    };
  }

  if (existingResponse.status !== 404) {
    const detail = await existingResponse.text();
    throw createError({
      statusCode: existingResponse.status,
      statusMessage: detail || "Failed to read replication job.",
    });
  }

  const createResponse = await fetch(`${localCouchUrl}/_replicator`, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(replicatorDoc),
  });

  if (!createResponse.ok) {
    const detail = await createResponse.text();
    throw createError({
      statusCode: createResponse.status,
      statusMessage: detail || "Failed to create replication job.",
    });
  }

  return {
    id: replicatorId,
    created: true,
  };
});
