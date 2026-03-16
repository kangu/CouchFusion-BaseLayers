import { assertAdminSession } from "#auth/server/utils/assert-admin-session";

interface ReplicatePayload {
  host: string;
  username: string;
  password: string;
  dbName: string;
  direction?: "down" | "up";
}

type ReplicationDirection = "down" | "up";

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

const buildReplicatorId = (
  dbName: string,
  direction: ReplicationDirection,
): string => {
  return `datasync-${direction}-${dbName}`;
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
  const direction: ReplicationDirection = body.direction === "up" ? "up" : "down";

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

  const remoteDbUrl = `${normalizedHost}/${encodeURIComponent(dbName)}`;
  const localDbUrl = `${localCouchUrl}/${encodeURIComponent(dbName)}`;
  const remoteAuthHeader = `Basic ${Buffer.from(
    `${username}:${password}`,
  ).toString("base64")}`;
  const localAuthHeader = `Basic ${localAdminAuth}`;
  const replicatorId = buildReplicatorId(dbName, direction);

  const source =
    direction === "up"
      ? {
          url: localDbUrl,
          headers: {
            Authorization: localAuthHeader,
          },
        }
      : {
          url: remoteDbUrl,
          headers: {
            Authorization: remoteAuthHeader,
          },
        };
  const target =
    direction === "up"
      ? {
          url: remoteDbUrl,
          headers: {
            Authorization: remoteAuthHeader,
          },
        }
      : {
          url: localDbUrl,
          headers: {
            Authorization: localAuthHeader,
          },
        };

  const replicatorDoc = {
    _id: replicatorId,
    source,
    target,
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
