<script setup lang="ts">
interface MaintenanceClient {
  _id: string;
  name: string;
}

interface MaintenanceContract {
  _id: string;
  clientId: string;
  startDate: string;
  expirationDate: string;
  checkupIntervalMonths: number | null;
  status: "active" | "expiring_soon" | "expired" | "renewed";
}

definePageMeta({
  layout: "admin-workspace",
  middleware: ["role-auth"],
  authAllowedRoles: ["admin"],
});

useHead({
  title: "Maintenance Contracts",
});

const requestHeaders = process.server ? useRequestHeaders(["cookie"]) : undefined;
const createPending = ref(false);
const createError = ref<string | null>(null);
const createSuccess = ref<string | null>(null);

const contractForm = reactive({
  clientId: "",
  startDate: "",
  expirationDate: "",
  checkupIntervalMonths: "6",
});

const {
  data: clientsData,
  refresh: refreshClients,
} = await useAsyncData(
  "maintenance-contract-clients",
  () =>
    $fetch<{ clients: MaintenanceClient[] }>("/api/maintenance/clients", {
      headers: requestHeaders,
      credentials: "include",
    }),
  {
    default: () => ({ clients: [] }),
  },
);

const {
  data: contractsData,
  pending: contractsPending,
  error: contractsError,
  refresh: refreshContracts,
} = await useAsyncData(
  "maintenance-contracts",
  () =>
    $fetch<{ contracts: MaintenanceContract[]; total: number }>(
      "/api/maintenance/contracts",
      {
        headers: requestHeaders,
        credentials: "include",
      },
    ),
  {
    default: () => ({ contracts: [], total: 0 }),
  },
);

const contracts = computed(() => contractsData.value?.contracts ?? []);
const clients = computed(() => clientsData.value?.clients ?? []);
const clientsById = computed(() => {
  const map = new Map<string, string>();
  for (const client of clients.value) {
    map.set(client._id, client.name);
  }
  return map;
});

const createContract = async () => {
  if (!contractForm.clientId || !contractForm.startDate || !contractForm.expirationDate) {
    createError.value = "Client, start date and expiration date are required.";
    return;
  }

  createPending.value = true;
  createError.value = null;
  createSuccess.value = null;

  try {
    await $fetch("/api/maintenance/contracts", {
      method: "POST",
      credentials: "include",
      body: {
        clientId: contractForm.clientId,
        startDate: contractForm.startDate,
        expirationDate: contractForm.expirationDate,
        checkupIntervalMonths: Number.parseInt(contractForm.checkupIntervalMonths, 10),
      },
    });

    createSuccess.value = "Contract created successfully.";
    contractForm.startDate = "";
    contractForm.expirationDate = "";
    await refreshContracts();
    await refreshClients();
  } catch (error: any) {
    createError.value =
      error?.data?.statusMessage || error?.message || "Failed to create contract.";
  } finally {
    createPending.value = false;
  }
};
</script>

<template>
  <div class="space-y-6">
    <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h1 class="text-2xl font-semibold text-slate-900">Contracts</h1>
      <p class="mt-2 text-sm text-slate-600">
        Track expiration windows and checkup cadence for maintenance agreements.
      </p>
    </section>

    <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 class="text-lg font-semibold text-slate-900">Create Contract</h2>
      <div class="mt-4 grid gap-4 md:grid-cols-2">
        <label class="space-y-1 text-sm text-slate-700 md:col-span-2">
          <span>Client</span>
          <select
            v-model="contractForm.clientId"
            class="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-orange-500 focus:outline-none"
          >
            <option value="">Select client</option>
            <option
              v-for="client in clients"
              :key="client._id"
              :value="client._id"
            >
              {{ client.name }}
            </option>
          </select>
        </label>

        <label class="space-y-1 text-sm text-slate-700">
          <span>Start date</span>
          <input
            v-model="contractForm.startDate"
            type="date"
            class="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-orange-500 focus:outline-none"
          >
        </label>

        <label class="space-y-1 text-sm text-slate-700">
          <span>Expiration date</span>
          <input
            v-model="contractForm.expirationDate"
            type="date"
            class="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-orange-500 focus:outline-none"
          >
        </label>

        <label class="space-y-1 text-sm text-slate-700">
          <span>Checkup interval (months)</span>
          <input
            v-model="contractForm.checkupIntervalMonths"
            type="number"
            min="1"
            max="24"
            class="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-orange-500 focus:outline-none"
          >
        </label>
      </div>

      <p
        v-if="createError"
        class="mt-3 text-sm text-red-600"
      >
        {{ createError }}
      </p>
      <p
        v-if="createSuccess"
        class="mt-3 text-sm text-emerald-700"
      >
        {{ createSuccess }}
      </p>

      <button
        type="button"
        class="mt-4 inline-flex items-center rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
        :disabled="createPending"
        @click="createContract"
      >
        {{ createPending ? "Creating..." : "Create contract" }}
      </button>
    </section>

    <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div class="flex items-center justify-between gap-4">
        <h2 class="text-lg font-semibold text-slate-900">Contract List</h2>
        <button
          type="button"
          class="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          @click="refreshContracts"
        >
          Refresh
        </button>
      </div>

      <p
        v-if="contractsError"
        class="mt-4 text-sm text-red-600"
      >
        Failed to load contracts.
      </p>
      <p
        v-else-if="contractsPending"
        class="mt-4 text-sm text-slate-600"
      >
        Loading contracts...
      </p>
      <div
        v-else-if="!contracts.length"
        class="mt-4 rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-600"
      >
        No contracts yet.
      </div>

      <div
        v-else
        class="mt-4 overflow-x-auto"
      >
        <table class="min-w-full divide-y divide-slate-200 text-sm">
          <thead class="bg-slate-50 text-left text-slate-600">
            <tr>
              <th class="px-3 py-2 font-medium">Client</th>
              <th class="px-3 py-2 font-medium">Start</th>
              <th class="px-3 py-2 font-medium">Expires</th>
              <th class="px-3 py-2 font-medium">Interval</th>
              <th class="px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr
              v-for="contract in contracts"
              :key="contract._id"
            >
              <td class="px-3 py-2 text-slate-900">
                {{ clientsById.get(contract.clientId) || contract.clientId }}
              </td>
              <td class="px-3 py-2 text-slate-700">{{ contract.startDate }}</td>
              <td class="px-3 py-2 text-slate-700">{{ contract.expirationDate }}</td>
              <td class="px-3 py-2 text-slate-700">
                {{ contract.checkupIntervalMonths || "default" }}
              </td>
              <td class="px-3 py-2 text-slate-700">{{ contract.status }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>
