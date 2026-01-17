<script setup lang="ts">
import { useLocalStorage } from "@vueuse/core";

interface RemoteDbsResponse {
  databases: string[];
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
 * Request the database list from the remote CouchDB host via server proxy.
 */
const fetchDatabases = async () => {
  errorMessage.value = null;
  databases.value = [];
  lastFetchedAt.value = null;

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
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to load databases from the remote host.";
    errorMessage.value = message;
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
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr v-if="!sortedDatabases.length">
              <td class="px-4 py-4 text-sm text-gray-500">
                No databases loaded yet.
              </td>
            </tr>
            <tr v-for="db in sortedDatabases" :key="db">
              <td class="px-4 py-3 text-sm text-gray-700">{{ db }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>
