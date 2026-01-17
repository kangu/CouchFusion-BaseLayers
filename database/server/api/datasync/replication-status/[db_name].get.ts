import { assertAdminSession } from "#auth/server/utils/assert-admin-session";

interface ReplicationStatusResponse {
  state?: string;
  error?: string;
  info?: string;
}

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

  const dbName = getRouterParam(event, "db_name");
  if (!dbName) {
    throw createError({ statusCode: 400, statusMessage: "Database name missing." });
  }

  if (!localCouchUrl || !localAdminAuth) {
    throw createError({
      statusCode: 500,
      statusMessage: "Local CouchDB configuration missing.",
    });
  }

  const authHeader = `Basic ${localAdminAuth}`;
  const replicatorId = buildReplicatorId(dbName);

  const replicatorResponse = await fetch(
    `${localCouchUrl}/_replicator/${encodeURIComponent(replicatorId)}`,
    {
      headers: {
        Authorization: authHeader,
      },
    },
  );

  if (replicatorResponse.status === 404) {
    return {
      state: "not_found",
      error: null,
      warning: null,
      task: null,
    };
  }

  if (!replicatorResponse.ok) {
    const detail = await replicatorResponse.text();
    throw createError({
      statusCode: replicatorResponse.status,
      statusMessage: detail || "Failed to read replication job.",
    });
  }

  const replicatorDoc = await replicatorResponse.json();
  const error = replicatorDoc._replication_state === "error"
    ? replicatorDoc._replication_state_reason
    : null;
  const warning =
    Array.isArray(replicatorDoc._replication_state_info) &&
    replicatorDoc._replication_state_info.length
      ? JSON.stringify(replicatorDoc._replication_state_info)
      : null;

  const activeTasksResponse = await fetch(`${localCouchUrl}/_active_tasks`, {
    headers: {
      Authorization: authHeader,
    },
  });

  if (!activeTasksResponse.ok) {
    const detail = await activeTasksResponse.text();
    throw createError({
      statusCode: activeTasksResponse.status,
      statusMessage: detail || "Failed to read active tasks.",
    });
  }

  const activeTasks = await activeTasksResponse.json();
  const task = Array.isArray(activeTasks)
    ? activeTasks.find((entry) =>
        entry &&
        (entry.replication_id === replicatorId ||
          entry.doc_id === replicatorId ||
          entry.database === replicatorId),
      )
    : null;

  return {
    state: replicatorDoc._replication_state || "unknown",
    error,
    warning,
    task,
  };
});
