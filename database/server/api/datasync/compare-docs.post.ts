import { assertAdminSession } from "#auth/server/utils/assert-admin-session";

interface CompareDocsPayload {
  host: string;
  username: string;
  password: string;
  dbName: string;
  page?: number;
  pageSize?: number;
  search?: string;
}

interface AllDocsRow {
  id: string;
  key: string;
  value?: {
    rev?: string;
  };
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

const fetchAllDocs = async (
  baseUrl: string,
  authHeader: string,
  dbName: string,
): Promise<AllDocsRow[]> => {
  const response = await fetch(
    `${baseUrl}/${encodeURIComponent(dbName)}/_all_docs`,
    {
      headers: {
        Authorization: authHeader,
      },
    },
  );

  if (response.status === 404) {
    return [];
  }

  if (!response.ok) {
    const detail = await response.text();
    throw createError({
      statusCode: response.status,
      statusMessage: detail || "Failed to read documents.",
    });
  }

  const payload = await response.json();
  return Array.isArray(payload?.rows) ? payload.rows : [];
};

export default defineEventHandler(async (event) => {
  await assertAdminSession(event);

  const runtimeConfig = useRuntimeConfig();
  const localCouchUrl =
    typeof runtimeConfig.couchUrl === "string"
      ? runtimeConfig.couchUrl.replace(/\/+$/, "")
      : "";
  const localAdminAuth = process.env.COUCHDB_ADMIN_AUTH;

  const body = (await readBody(event)) as CompareDocsPayload | null;

  if (!body) {
    throw createError({ statusCode: 400, statusMessage: "Missing request body." });
  }

  const host = typeof body.host === "string" ? body.host : "";
  const username = typeof body.username === "string" ? body.username : "";
  const password = typeof body.password === "string" ? body.password : "";
  const dbName = typeof body.dbName === "string" ? body.dbName : "";
  const page = typeof body.page === "number" ? body.page : 1;
  const pageSize = typeof body.pageSize === "number" ? body.pageSize : 50;
  const search = typeof body.search === "string" ? body.search.trim() : "";

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

  const remoteAuthHeader = `Basic ${Buffer.from(
    `${username}:${password}`,
  ).toString("base64")}`;
  const localAuthHeader = `Basic ${localAdminAuth}`;

  const [remoteRows, localRows] = await Promise.all([
    fetchAllDocs(normalizedHost, remoteAuthHeader, dbName),
    fetchAllDocs(localCouchUrl, localAuthHeader, dbName),
  ]);

  const remoteMap = new Map(
    remoteRows.map((row) => [row.id, row.value?.rev ?? null]),
  );
  const localMap = new Map(
    localRows.map((row) => [row.id, row.value?.rev ?? null]),
  );

  const allIds = new Set([...remoteMap.keys(), ...localMap.keys()]);
  const searchLower = search ? search.toLowerCase() : "";

  const entries = Array.from(allIds)
    .filter((id) => (searchLower ? id.toLowerCase().includes(searchLower) : true))
    .map((id) => {
      const remoteRev = remoteMap.get(id) ?? null;
      const localRev = localMap.get(id) ?? null;

      let status = "both-different-rev";
      if (remoteRev && localRev) {
        status = remoteRev === localRev ? "both-same-rev" : "both-different-rev";
      } else if (localRev) {
        status = "local-only";
      } else if (remoteRev) {
        status = "remote-only";
      }

      return {
        id,
        localRev,
        remoteRev,
        status,
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));

  const total = entries.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = (safePage - 1) * pageSize;
  const end = start + pageSize;

  const counts = entries.reduce(
    (acc, entry) => {
      acc[entry.status] = (acc[entry.status] || 0) + 1;
      return acc;
    },
    {
      "local-only": 0,
      "remote-only": 0,
      "both-same-rev": 0,
      "both-different-rev": 0,
    },
  );

  return {
    page: safePage,
    pageSize,
    total,
    totalPages,
    counts,
    entries: entries.slice(start, end),
  };
});
