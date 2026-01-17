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

interface DbInfoState {
  isLoading: boolean;
  error: string | null;
  info: RemoteDbInfoResponse | null;
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

// == computed ==
const trimmedHost = computed(() => host.value.trim());
const isReady = computed(
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
 * Fetch info for a single database and update its status entry.
 */
const fetchDbInfo = async (dbName: string): Promise<DbInfoState> => {
  try {
    const info = await $fetch<RemoteDbInfoResponse>(
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
      <div class="mt-8 grid gap-6 lg:grid-cols-[2fr_1fr_1fr]">
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
          <p class="text-xs text-gray-500">Stored locally in this browser.</p>
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
                Active
              </th>
              <th
                scope="col"
                class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500"
              >
                External
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
                Instance start
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr v-if="!sortedDatabases.length">
              <td class="px-4 py-4 text-sm text-gray-500" colspan="7">
                No databases loaded yet.
              </td>
            </tr>
            <tr v-else-if="isDetailsLoading">
              <td class="px-4 py-4 text-sm text-gray-500" colspan="7">
                Loading database details…
              </td>
            </tr>
            <tr v-for="db in sortedDatabases" :key="db">
              <td class="px-4 py-3 text-sm text-gray-700">{{ db }}</td>
              <td class="px-4 py-3 text-sm text-gray-700">
                <span v-if="dbInfoMap[db]?.error" class="text-red-500">
                  Error
                </span>
                <span v-else>{{ dbInfoMap[db]?.info?.doc_count ?? "-" }}</span>
              </td>
              <td class="px-4 py-3 text-sm text-gray-700">
                <span v-if="dbInfoMap[db]?.error" class="text-red-500">
                  Error
                </span>
                <span v-else>{{ dbInfoMap[db]?.info?.sizes?.active ?? "-" }}</span>
              </td>
              <td class="px-4 py-3 text-sm text-gray-700">
                <span v-if="dbInfoMap[db]?.error" class="text-red-500">
                  Error
                </span>
                <span v-else>{{ dbInfoMap[db]?.info?.sizes?.external ?? "-" }}</span>
              </td>
              <td class="px-4 py-3 text-sm text-gray-700">
                <span v-if="dbInfoMap[db]?.error" class="text-red-500">
                  Error
                </span>
                <span v-else>{{ dbInfoMap[db]?.info?.sizes?.file ?? "-" }}</span>
              </td>
              <td class="px-4 py-3 text-sm text-gray-700">
                <span v-if="dbInfoMap[db]?.error" class="text-red-500">
                  Error
                </span>
                <span
                  v-else
                  class="line-clamp-1"
                  :title="dbInfoMap[db]?.info?.update_seq"
                >
                  {{
                    getUpdateSeqNumber(dbInfoMap[db]?.info?.update_seq) ??
                      "-"
                  }}
                </span>
              </td>
              <td class="px-4 py-3 text-sm text-gray-700">
                <span v-if="dbInfoMap[db]?.error" class="text-red-500">
                  Error
                </span>
                <span v-else>{{ dbInfoMap[db]?.info?.instance_start_time ?? "-" }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>
