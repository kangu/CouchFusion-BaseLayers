<script setup lang="ts">
import { useLocalStorage } from "@vueuse/core";

interface RemoteDbsResponse {
  databases: string[];
}

interface RemoteDbInfoResponse {
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

interface DbInfoPayload {
  remote: RemoteDbInfoResponse | null;
  local: RemoteDbInfoResponse | null;
}

interface DbInfoState {
  isLoading: boolean;
  error: string | null;
  info: DbInfoPayload | null;
}

interface ReplicationStatus {
  state?: string;
  error?: string | null;
  warning?: string | null;
  task?: {
    progress?: number;
    changes_done?: number;
    total_changes?: number;
  } | null;
}

/**
 * Admin data sync page for database tooling.
 */
definePageMeta({
  middleware: ["admin-auth"],
});

// == props ==

// == composables ==
const host = useLocalStorage("database-datasync-host", "");
const username = useLocalStorage("database-datasync-username", "");
const password = useLocalStorage("database-datasync-password", "");

// == local data ==
const databases = ref<string[]>([]);
const errorMessage = ref<string | null>(null);
const isLoading = ref(false);
const lastFetchedAt = ref<string | null>(null);
const isClient = ref(false);
const dbInfoMap = ref<Record<string, DbInfoState>>({});
const isDetailsLoading = ref(false);
const isEditing = ref(false);
const replicationStatusMap = ref<Record<string, ReplicationStatus>>({});
const replicationLoadingMap = ref<Record<string, boolean>>({});
const replicationPollers = ref<Record<string, ReturnType<typeof setInterval>>>({});

// == computed ==
const trimmedHost = computed(() => host.value.trim());
const isReady = computed(
  () =>
    isClient.value &&
    Boolean(trimmedHost.value) &&
    Boolean(username.value) &&
    Boolean(password.value),
);
const hasCredentials = computed(
  () =>
    isClient.value &&
    Boolean(trimmedHost.value) &&
    Boolean(username.value) &&
    Boolean(password.value),
);
const sortedDatabases = computed(() => [...databases.value].sort());

// == lifecycle ==
onMounted(() => {
  isClient.value = true;
  if (hasCredentials.value) {
    fetchDatabases();
  }
});

onUnmounted(() => {
  for (const poller of Object.values(replicationPollers.value)) {
    clearInterval(poller);
  }
  replicationPollers.value = {};
});

// == watchers ==

// == local page api ==
/**
 * Initialize the per-database info state map.
 */
const resetDbInfoState = (names: string[]) => {
  const nextState: Record<string, DbInfoState> = {};
  for (const name of names) {
    nextState[name] = {
      isLoading: true,
      error: null,
      info: null,
    };
  }
  dbInfoMap.value = nextState;
};

/**
 * Extract the leading numeric part from CouchDB update_seq values.
 */
const getUpdateSeqNumber = (value?: string): string | null => {
  if (!value) {
    return null;
  }

  const match = value.match(/^\d+/);
  return match ? match[0] : null;
};

/**
 * Format byte sizes into human readable units.
 */
const formatBytes = (value?: number): string => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "-";
  }

  if (value < 1024) {
    return `${value} B`;
  }

  const units = ["KB", "MB", "GB", "TB"];
  let current = value / 1024;
  let index = 0;

  while (current >= 1024 && index < units.length - 1) {
    current /= 1024;
    index += 1;
  }

  return `${current.toFixed(current >= 10 ? 0 : 1)} ${units[index]}`;
};

/**
 * Fetch info for a single database and update its status entry.
 */
const fetchDbInfo = async (dbName: string): Promise<DbInfoState> => {
  try {
    const info = await $fetch<DbInfoPayload>(
      `/api/datasync/db-info/${encodeURIComponent(dbName)}`,
      {
        method: "POST",
        body: {
          host: trimmedHost.value,
          username: username.value,
          password: password.value,
        },
      },
    );

    return {
      isLoading: false,
      error: null,
      info,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to load database info.";
    return {
      isLoading: false,
      error: message,
      info: null,
    };
  }
};

const fetchReplicationStatus = async (dbName: string) => {
  try {
    const status = await $fetch<ReplicationStatus>(
      `/api/datasync/replication-status/${encodeURIComponent(dbName)}`,
    );
    replicationStatusMap.value[dbName] = status;
    if (status?.state === "completed") {
      stopReplicationPolling(dbName);
      await refreshDbInfoForDb(dbName);
    }
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to load replication status.";
    replicationStatusMap.value[dbName] = {
      state: "error",
      error: message,
    };
  }
};

const startReplicationPolling = (dbName: string) => {
  if (replicationPollers.value[dbName]) {
    return;
  }

  fetchReplicationStatus(dbName);
  replicationPollers.value[dbName] = setInterval(() => {
    fetchReplicationStatus(dbName);
  }, 4000);
};

const stopReplicationPolling = (dbName: string) => {
  const poller = replicationPollers.value[dbName];
  if (poller) {
    clearInterval(poller);
    delete replicationPollers.value[dbName];
  }
};

const refreshDbInfoForDb = async (dbName: string) => {
  const nextState = await fetchDbInfo(dbName);
  dbInfoMap.value = {
    ...dbInfoMap.value,
    [dbName]: nextState,
  };
};

const isReplicationActive = (status?: ReplicationStatus | null): boolean => {
  if (!status) {
    return false;
  }

  if (status.state === "completed" || status.state === "not_found") {
    return false;
  }

  if (status.error) {
    return false;
  }

  return true;
};

const getDocsCellStatusClass = (dbName: string): string => {
  if (isReplicationActive(replicationStatusMap.value[dbName])) {
    return "bg-amber-50/40";
  }

  const info = dbInfoMap.value[dbName]?.info;
  if (!info) {
    return "";
  }

  if (!info.local) {
    return "bg-red-50/40";
  }

  const localCount = info.local.doc_count;
  const remoteCount = info.remote?.doc_count;

  if (typeof localCount === "number" && typeof remoteCount === "number") {
    if (localCount === remoteCount) {
      return "bg-green-50/40";
    }

    if (localCount > remoteCount) {
      return "bg-teal-50/40";
    }

    if (remoteCount > localCount) {
      return "bg-orange-50/40";
    }
  }

  return "";
};

const triggerReplication = async (dbName: string) => {
  if (!isReady.value || replicationLoadingMap.value[dbName]) {
    return;
  }

  replicationLoadingMap.value[dbName] = true;
  replicationStatusMap.value[dbName] = {
    state: "starting",
  };

  try {
    await $fetch("/api/datasync/replicate", {
      method: "POST",
      body: {
        host: trimmedHost.value,
        username: username.value,
        password: password.value,
        dbName,
      },
    });

    startReplicationPolling(dbName);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to start replication.";
    replicationStatusMap.value[dbName] = {
      state: "error",
      error: message,
    };
  } finally {
    replicationLoadingMap.value[dbName] = false;
  }
};

const getReplicationProgressLabel = (status?: ReplicationStatus | null) => {
  if (!status) {
    return "Idle";
  }

  if (status.error) {
    return "Error";
  }

  if (status.state === "not_found") {
    return "Not started";
  }

  if (status.task?.progress != null) {
    return `${status.task.progress}%`;
  }

  if (
    status.task?.changes_done != null &&
    status.task?.total_changes != null
  ) {
    return `${status.task.changes_done}/${status.task.total_changes}`;
  }

  return status.state || "Idle";
};

/**
 * Request the database list from the remote CouchDB host via server proxy.
 */
const fetchDatabases = async () => {
  errorMessage.value = null;
  databases.value = [];
  lastFetchedAt.value = null;
  dbInfoMap.value = {};

  if (!trimmedHost.value) {
    errorMessage.value = "Enter a remote host to continue.";
    return;
  }

  if (!username.value || !password.value) {
    errorMessage.value = "Enter both username and password to continue.";
    return;
  }

  if (!process.client) {
    errorMessage.value = "This action is only available in the browser.";
    return;
  }

  isLoading.value = true;

  try {
    const response = await $fetch<RemoteDbsResponse>(
      "/api/datasync/remote-dbs",
      {
        method: "POST",
        body: {
          host: trimmedHost.value,
          username: username.value,
          password: password.value,
        },
      },
    );

    if (!response?.databases || !Array.isArray(response.databases)) {
      throw new Error("Unexpected response from the server.");
    }

    databases.value = response.databases;
    lastFetchedAt.value = new Date().toISOString();
    resetDbInfoState(response.databases);
    isDetailsLoading.value = true;

    const infoEntries = await Promise.all(
      response.databases.map(async (dbName) => ({
        dbName,
        state: await fetchDbInfo(dbName),
      })),
    );

    const nextMap: Record<string, DbInfoState> = {};
    for (const entry of infoEntries) {
      nextMap[entry.dbName] = entry.state;
    }

    dbInfoMap.value = nextMap;
    isDetailsLoading.value = false;
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to load databases from the remote host.";
    errorMessage.value = message;
    isDetailsLoading.value = false;
  } finally {
    isLoading.value = false;
  }
};

/**
 * Trigger a refresh of databases and details.
 */
const handleRefresh = async () => {
  await fetchDatabases();
};

/**
 * Toggle edit mode for the connection form.
 */
const handleEdit = () => {
  isEditing.value = true;
};
</script>

<template>
  <section class="space-y-8">
    <div
      class="rounded-2xl border border-orange-200 bg-gradient-to-br from-orange-50 via-white to-orange-100 px-8 py-10 shadow-sm"
    >
      <div class="space-y-3">
        <h1 class="text-3xl font-semibold text-gray-900">Database Data Sync</h1>
        <p class="text-sm text-gray-700 max-w-2xl">
          Configure a remote CouchDB host over HTTPS and authenticate with
          Basic Auth. The credentials are saved locally in this browser.
        </p>
      </div>

      <div
        v-if="hasCredentials && !isEditing"
        class="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-orange-100 bg-white/70 px-4 py-4"
      >
        <div>
          <p class="text-xs uppercase tracking-wide text-orange-500">
            Connected host
          </p>
          <p class="text-sm font-semibold text-gray-900">{{ trimmedHost }}</p>
        </div>
        <div class="flex items-center gap-3">
          <button
            type="button"
            class="inline-flex items-center rounded-md border border-transparent bg-orange-custom px-4 py-2 text-sm font-medium text-white hover:bg-orange-custom-hover focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:opacity-50"
            :disabled="!isReady || isLoading"
            @click="handleRefresh"
          >
            <span v-if="isLoading">Refreshing…</span>
            <span v-else>Refresh</span>
          </button>
          <button
            type="button"
            class="text-sm font-medium text-gray-700 hover:text-gray-900"
            @click="handleEdit"
          >
            Edit
          </button>
        </div>
      </div>

      <div v-else class="mt-8">
        <div class="grid gap-6 lg:grid-cols-[2fr_1fr_1fr]">
          <div class="space-y-1">
            <label class="block text-sm font-medium text-gray-800">
              Remote host (https)
            </label>
            <input
              v-model="host"
              type="text"
              placeholder="https://db.example.com"
              class="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-500/70 focus:outline-none"
            />
            <p class="text-xs text-gray-500">
              Enter the base URL for the CouchDB instance.
            </p>
          </div>
          <div class="space-y-1">
            <label class="block text-sm font-medium text-gray-800">
              Username
            </label>
            <input
              v-model="username"
              type="text"
              autocomplete="username"
              class="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-500/70 focus:outline-none"
            />
            <p class="text-xs text-gray-500">
              CouchDB admin or service account.
            </p>
          </div>
          <div class="space-y-1">
            <label class="block text-sm font-medium text-gray-800">
              Password
            </label>
            <input
              v-model="password"
              type="password"
              autocomplete="current-password"
              class="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-500/70 focus:outline-none"
            />
            <p class="text-xs text-gray-500">
              Stored locally in this browser.
            </p>
          </div>
        </div>
        <div class="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            class="inline-flex items-center rounded-md border border-transparent bg-orange-custom px-4 py-2 text-sm font-medium text-white hover:bg-orange-custom-hover focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:opacity-50"
            :disabled="!isReady || isLoading"
            @click="fetchDatabases"
          >
            <span v-if="isLoading">Fetching…</span>
            <span v-else>Fetch Databases</span>
          </button>
          <p v-if="errorMessage" class="text-sm text-red-600">
            {{ errorMessage }}
          </p>
          <p v-else class="text-xs text-gray-500">
            Results appear below once the connection succeeds.
          </p>
        </div>
      </div>
    </div>

    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-lg font-semibold text-gray-900">Remote databases</h2>
          <p class="text-xs text-gray-500">
            {{ databases.length }} databases loaded
            <span v-if="lastFetchedAt">
              · last fetched {{ new Date(lastFetchedAt).toLocaleString() }}
            </span>
          </p>
        </div>
      </div>

      <div
        class="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm"
      >
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th
                scope="col"
                class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500"
              >
                Database name
              </th>
              <th
                scope="col"
                class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500"
              >
                Docs
              </th>
              <th
                scope="col"
                class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500"
              >
                File
              </th>
              <th
                scope="col"
                class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500"
              >
                Update seq
              </th>
              <th
                scope="col"
                class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500"
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr v-if="!sortedDatabases.length">
              <td class="px-4 py-4 text-sm text-gray-500" colspan="5">
                No databases loaded yet.
              </td>
            </tr>
            <tr v-else-if="isDetailsLoading">
              <td class="px-4 py-4 text-sm text-gray-500" colspan="5">
                Loading database details…
              </td>
            </tr>
            <tr v-for="db in sortedDatabases" :key="db">
              <td class="px-4 py-3 text-sm text-gray-700">{{ db }}</td>
              <td
                class="px-4 py-3 text-sm text-gray-700"
                :class="getDocsCellStatusClass(db)"
              >
                <span v-if="dbInfoMap[db]?.error" class="text-red-500">
                  Error
                </span>
                <div v-else class="flex items-center gap-3">
                  <span class="inline-flex items-center font-semibold text-gray-900">
                    <svg
                      class="mr-1 h-3 w-3 text-gray-400"
                      viewBox="0 0 12 12"
                      fill="currentColor"
                      aria-hidden="true"
                      title="Local"
                    >
                      <circle cx="6" cy="6" r="5" />
                      <path
                        d="M4.6 3.8h1v4.4H4.6zM4.6 8.2h2.8v1H4.6z"
                        fill="#ffffff"
                      />
                    </svg>
                    {{ dbInfoMap[db]?.info?.local?.doc_count ?? "-" }}
                  </span>
                  <span class="inline-flex items-center font-semibold text-gray-900">
                    <svg
                      class="mr-1 h-3 w-3 text-gray-400"
                      viewBox="0 0 12 12"
                      fill="currentColor"
                      aria-hidden="true"
                      title="Remote"
                    >
                      <circle cx="6" cy="6" r="5" />
                      <path
                        d="M4.1 3.6h2.2c1.3 0 2.1.7 2.1 1.7 0 .7-.4 1.3-1.1 1.5L8 8.6H6.8L6.2 7H5.1v1.6h-1V3.6Zm1 2.5h1.1c.6 0 1-.3 1-.8 0-.5-.4-.8-1-.8H5.1v1.6Z"
                        fill="#ffffff"
                      />
                    </svg>
                    {{ dbInfoMap[db]?.info?.remote?.doc_count ?? "-" }}
                  </span>
                </div>
              </td>
              <td class="px-4 py-3 text-sm text-gray-700">
                <span v-if="dbInfoMap[db]?.error" class="text-red-500">
                  Error
                </span>
                <div v-else class="flex items-center gap-3">
                  <span class="inline-flex items-center">
                    {{
                      formatBytes(dbInfoMap[db]?.info?.local?.sizes?.file)
                    }}
                  </span>
                  <span class="inline-flex items-center">
                    {{
                      formatBytes(dbInfoMap[db]?.info?.remote?.sizes?.file)
                    }}
                  </span>
                </div>
              </td>
              <td class="px-4 py-3 text-sm text-gray-700">
                <span v-if="dbInfoMap[db]?.error" class="text-red-500">
                  Error
                </span>
                <div v-else class="flex items-center gap-3">
                  <span class="inline-flex items-center font-semibold text-gray-900">
                    <svg
                      class="mr-1 h-3 w-3 text-gray-400"
                      viewBox="0 0 12 12"
                      fill="currentColor"
                      aria-hidden="true"
                      title="Local"
                    >
                      <circle cx="6" cy="6" r="5" />
                      <path
                        d="M4.6 3.8h1v4.4H4.6zM4.6 8.2h2.8v1H4.6z"
                        fill="#ffffff"
                      />
                    </svg>
                    {{
                      getUpdateSeqNumber(
                        dbInfoMap[db]?.info?.local?.update_seq,
                      ) ?? "-"
                    }}
                  </span>
                  <span class="inline-flex items-center font-semibold text-gray-900">
                    <svg
                      class="mr-1 h-3 w-3 text-gray-400"
                      viewBox="0 0 12 12"
                      fill="currentColor"
                      aria-hidden="true"
                      title="Remote"
                    >
                      <circle cx="6" cy="6" r="5" />
                      <path
                        d="M4.1 3.6h2.2c1.3 0 2.1.7 2.1 1.7 0 .7-.4 1.3-1.1 1.5L8 8.6H6.8L6.2 7H5.1v1.6h-1V3.6Zm1 2.5h1.1c.6 0 1-.3 1-.8 0-.5-.4-.8-1-.8H5.1v1.6Z"
                        fill="#ffffff"
                      />
                    </svg>
                    {{
                      getUpdateSeqNumber(
                        dbInfoMap[db]?.info?.remote?.update_seq,
                      ) ?? "-"
                    }}
                  </span>
                </div>
              </td>
              <td class="px-4 py-3 text-sm text-gray-700">
                <div class="space-y-1">
                  <button
                    type="button"
                    class="inline-flex items-center rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    :disabled="replicationLoadingMap[db]"
                  @click="triggerReplication(db)"
                >
                  <span v-if="replicationLoadingMap[db]">Starting…</span>
                  <span v-else>Replicate Down</span>
                </button>
                <div class="text-xs text-gray-500">
                  {{ getReplicationProgressLabel(replicationStatusMap[db]) }}
                </div>
                <div
                  v-show="isReplicationActive(replicationStatusMap[db])"
                  class="text-[11px] text-orange-500"
                >
                  Replication in progress…
                </div>
                <div
                  v-show="replicationStatusMap[db]?.error"
                  class="text-xs text-red-500"
                >
                  {{ replicationStatusMap[db]?.error }}
                </div>
                <div
                  v-show="!replicationStatusMap[db]?.error && replicationStatusMap[db]?.warning"
                  class="text-xs text-orange-500"
                >
                  {{ replicationStatusMap[db]?.warning }}
                </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>
