<script setup lang="ts">
import { normalizeGasSensorFormFields } from "../../../utils/client-form";

interface MaintenanceClient {
  _id: string;
  name: string;
  contractExpirationStatus: "active" | "expiring_soon" | "expired" | "renewed";
  overhaulExpirationStatus: "active" | "expiring_soon" | "expired" | "renewed";
  gasSensorExpirationStatus: "active" | "expiring_soon" | "expired" | "renewed";
  contractStartDate: string | null;
  contractExpirationDate: string | null;
  contractCheckupIntervalMonths: number | null;
  overhaulExpirationDate: string | null;
  gasSensorExpirationDate: string | null;
  gasSensorPeriodMonths: number | null;
  primaryContactName: string | null;
  counterId: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  serviceAddress: {
    line1: string;
    city?: string | null;
    country?: string | null;
  };
}

type ClientDialogMode = "create" | "edit";

definePageMeta({
  layout: "admin-workspace",
  middleware: ["auth", "role-auth"],
  authAllowedRoles: ["admin"],
});

useHead({
  title: "Maintenance Clients",
});

const requestHeaders = process.server ? useRequestHeaders(["cookie"]) : undefined;
const route = useRoute();
const router = useRouter();
const savePending = ref(false);
const deletePending = ref(false);
const formError = ref<string | null>(null);
const actionError = ref<string | null>(null);
const actionSuccess = ref<string | null>(null);

const isDialogOpen = ref(false);
const dialogMode = ref<ClientDialogMode>("create");
const editingClientId = ref<string | null>(null);
const deleteClientTarget = ref<MaintenanceClient | null>(null);

const form = reactive({
  name: "",
  primaryContactName: "",
  counterId: "",
  customerEmail: "",
  customerPhone: "",
  addressLine1: "",
  city: "",
  country: "",
  contractStartDate: "",
  contractExpirationDate: "",
  overhaulExpirationDate: "",
  gasSensorExpirationDate: "",
  gasSensorPeriodMonths: "",
  contractExpirationStatus: "active" as "active" | "expiring_soon" | "expired" | "renewed",
  overhaulExpirationStatus: "active" as "active" | "expiring_soon" | "expired" | "renewed",
  gasSensorExpirationStatus: "active" as "active" | "expiring_soon" | "expired" | "renewed",
});

const serviceAddressMapsUrl = computed(() => {
  const parts = [form.addressLine1, form.city, form.country]
    .map((value) => String(value ?? "").trim())
    .filter((value) => value.length > 0);
  if (!parts.length) {
    return null;
  }
  const query = encodeURIComponent(parts.join(", "));
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
});

const {
  data: clientsData,
  pending: clientsPending,
  error: clientsError,
  refresh: refreshClients,
} = await useAsyncData(
  "maintenance-clients",
  () =>
    $fetch<{ clients: MaintenanceClient[]; total: number }>("/api/maintenance/clients", {
      headers: requestHeaders,
      credentials: "include",
    }),
  {
    default: () => ({
      clients: [],
      total: 0,
    }),
  },
);

const clients = computed(() => clientsData.value?.clients ?? []);

const clearCreateQuery = async () => {
  if (route.query.create !== "1") {
    return;
  }

  const nextQuery = { ...route.query };
  delete nextQuery.create;
  await router.replace({ query: nextQuery });
};

const resetForm = () => {
  form.name = "";
  form.primaryContactName = "";
  form.counterId = "";
  form.customerEmail = "";
  form.customerPhone = "";
  form.addressLine1 = "";
  form.city = "";
  form.country = "";
  form.contractStartDate = "";
  form.contractExpirationDate = "";
  form.overhaulExpirationDate = "";
  form.gasSensorExpirationDate = "";
  form.gasSensorPeriodMonths = "";
  form.contractExpirationStatus = "active";
  form.overhaulExpirationStatus = "active";
  form.gasSensorExpirationStatus = "active";
  editingClientId.value = null;
};

const openCreateDialog = () => {
  dialogMode.value = "create";
  formError.value = null;
  actionError.value = null;
  resetForm();
  isDialogOpen.value = true;
};

const openEditDialog = (client: MaintenanceClient) => {
  dialogMode.value = "edit";
  formError.value = null;
  actionError.value = null;

  editingClientId.value = client._id;
  form.name = client.name ?? "";
  form.primaryContactName = client.primaryContactName ?? "";
  form.counterId = client.counterId ?? "";
  form.customerEmail = client.customerEmail ?? "";
  form.customerPhone = client.customerPhone ?? "";
  form.addressLine1 = client.serviceAddress?.line1 ?? "";
  form.city = client.serviceAddress?.city ?? "";
  form.country = client.serviceAddress?.country ?? "";
  form.contractStartDate = client.contractStartDate ?? "";
  form.contractExpirationDate = client.contractExpirationDate ?? "";
  form.overhaulExpirationDate = client.overhaulExpirationDate ?? "";
  form.gasSensorExpirationDate = client.gasSensorExpirationDate ?? "";
  form.gasSensorPeriodMonths = client.gasSensorPeriodMonths
    ? String(client.gasSensorPeriodMonths)
    : "";
  form.contractExpirationStatus = client.contractExpirationStatus ?? "active";
  form.overhaulExpirationStatus = client.overhaulExpirationStatus ?? "active";
  form.gasSensorExpirationStatus = client.gasSensorExpirationStatus ?? "active";

  isDialogOpen.value = true;
};

const openDeleteDialog = (client: Pick<MaintenanceClient, "_id" | "name">) => {
  actionSuccess.value = null;
  actionError.value = null;
  deleteClientTarget.value = client as MaintenanceClient;
};

const closeDialog = () => {
  if (savePending.value) {
    return;
  }
  isDialogOpen.value = false;
  formError.value = null;
  void clearCreateQuery();
};

const closeDeleteDialog = () => {
  if (deletePending.value) {
    return;
  }

  deleteClientTarget.value = null;
};

const saveClient = async () => {
  const normalizedGasSensor = normalizeGasSensorFormFields({
    gasSensorExpirationDate: form.gasSensorExpirationDate,
    gasSensorPeriodMonths: form.gasSensorPeriodMonths,
  });

  if (!form.name.trim() || !form.addressLine1.trim()) {
    formError.value = "Name and service address are required.";
    return;
  }

  if ((form.contractStartDate && !form.contractExpirationDate) || (!form.contractStartDate && form.contractExpirationDate)) {
    formError.value = "Contract start and expiration dates must be provided together.";
    return;
  }

  if (normalizedGasSensor.gasSensorExpirationDate) {
    const gasSensorPeriodMonths = normalizedGasSensor.gasSensorPeriodMonths;
    if (!Number.isInteger(gasSensorPeriodMonths) || gasSensorPeriodMonths <= 0) {
      formError.value = "Gas sensor period months must be a positive integer.";
      return;
    }
  }

  if (!form.customerEmail.trim() && !form.customerPhone.trim()) {
    formError.value = "At least one customer contact (email or phone) is required.";
    return;
  }

  savePending.value = true;
  formError.value = null;
  actionError.value = null;
  actionSuccess.value = null;

  try {
    const body = {
      name: form.name,
      primaryContactName: form.primaryContactName,
      counterId: form.counterId || null,
      customerEmail: form.customerEmail || null,
      customerPhone: form.customerPhone || null,
      serviceAddress: {
        line1: form.addressLine1,
        city: form.city || null,
        country: form.country || null,
      },
      contractStartDate: form.contractStartDate || null,
      contractExpirationDate: form.contractExpirationDate || null,
      contractExpirationStatus: form.contractExpirationDate
        ? form.contractExpirationStatus
        : null,
      overhaulExpirationDate: form.overhaulExpirationDate || null,
      overhaulExpirationStatus: form.overhaulExpirationDate
        ? form.overhaulExpirationStatus
        : null,
      gasSensorExpirationDate: normalizedGasSensor.gasSensorExpirationDate,
      gasSensorExpirationStatus: normalizedGasSensor.gasSensorExpirationDate
        ? form.gasSensorExpirationStatus
        : null,
      gasSensorPeriodMonths: normalizedGasSensor.gasSensorPeriodMonths,
    };

    if (dialogMode.value === "create") {
      await $fetch("/api/maintenance/clients", {
        method: "POST",
        credentials: "include",
        body,
      });
      actionSuccess.value = "Client created successfully.";
    } else {
      if (!editingClientId.value) {
        throw new Error("Missing client id for edit operation");
      }

      await $fetch(`/api/maintenance/clients/${encodeURIComponent(editingClientId.value)}`, {
        method: "PATCH",
        credentials: "include",
        body,
      });
      actionSuccess.value = "Client updated successfully.";
    }

    isDialogOpen.value = false;
    resetForm();
    await refreshClients();
  } catch (error: any) {
    formError.value =
      error?.data?.statusMessage || error?.message || "Failed to save client.";
  } finally {
    savePending.value = false;
  }
};

const deleteClient = async () => {
  if (!deleteClientTarget.value) {
    return;
  }

  deletePending.value = true;
  actionError.value = null;
  actionSuccess.value = null;

  try {
    await $fetch(`/api/maintenance/clients/${encodeURIComponent(deleteClientTarget.value._id)}`, {
      method: "DELETE",
      credentials: "include",
    });
    actionSuccess.value = "Client deleted successfully.";
    deleteClientTarget.value = null;
    await refreshClients();
  } catch (error: any) {
    actionError.value =
      error?.data?.statusMessage || error?.message || "Failed to delete client.";
  } finally {
    deletePending.value = false;
  }
};

watch(
  () => route.query.create,
  (createQuery) => {
    if (createQuery === "1" && !isDialogOpen.value) {
      openCreateDialog();
    }
  },
  { immediate: true },
);
</script>

<template>
  <div class="space-y-6">
    <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div class="flex items-center justify-between gap-4">
        <div>
          <h1 class="text-2xl font-semibold text-slate-900">Clients</h1>
          <p class="mt-2 text-sm text-slate-600">
            Manage customer records, customer contacts and contract lifecycle in one place.
          </p>
        </div>

        <button
          type="button"
          data-testid="clients-new-button"
          class="inline-flex items-center rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700"
          @click="openCreateDialog"
        >
          New Client
        </button>
      </div>

      <p
        v-if="actionSuccess"
        class="mt-3 text-sm text-emerald-700"
      >
        {{ actionSuccess }}
      </p>

      <p
        v-if="actionError"
        class="mt-3 text-sm text-red-600"
      >
        {{ actionError }}
      </p>
    </section>

    <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div class="flex items-center justify-between gap-4">
        <h2 class="text-lg font-semibold text-slate-900">Client List</h2>
        <button
          type="button"
          class="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          @click="refreshClients"
        >
          Refresh
        </button>
      </div>

      <p
        v-if="clientsError"
        class="mt-4 text-sm text-red-600"
      >
        Failed to load clients.
      </p>

      <p
        v-else-if="clientsPending"
        class="mt-4 text-sm text-slate-600"
      >
        Loading clients...
      </p>

      <div
        v-else-if="!clients.length"
        class="mt-4 rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-600"
      >
        No clients yet.
      </div>

      <div
        v-else
        class="mt-4 overflow-x-auto"
      >
        <table class="min-w-full divide-y divide-slate-200 text-sm">
          <thead class="bg-slate-50 text-left text-slate-600">
            <tr>
              <th class="px-3 py-2 font-medium">Name</th>
              <th class="px-3 py-2 font-medium">Primary contact</th>
              <th class="px-3 py-2 font-medium">Address</th>
              <th class="px-3 py-2 font-medium">Customer contacts</th>
              <th class="px-3 py-2 font-medium">2Y expiration</th>
              <th class="px-3 py-2 font-medium">10Y expiration</th>
              <th class="px-3 py-2 font-medium">Gas sensor expiration</th>
              <th class="px-3 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr
              v-for="client in clients"
              :key="client._id"
              data-testid="client-row"
            >
              <td class="px-3 py-2 text-slate-900">{{ client.name }}</td>
              <td class="px-3 py-2 text-slate-700">{{ client.primaryContactName || "-" }}</td>
              <td class="px-3 py-2 text-slate-700">
                {{ client.serviceAddress.line1 }}
                <span v-if="client.serviceAddress.city">, {{ client.serviceAddress.city }}</span>
              </td>
              <td class="px-3 py-2 text-slate-700">
                <div class="flex flex-col items-start gap-1">
                  <span class="mr-2 inline-flex flex-col rounded-full bg-slate-100 px-2 py-0.5 text-xs">
                    email: {{ client.customerEmail || "-" }}
                  </span>
                  <span class="mr-2 inline-flex flex-col rounded-full bg-slate-100 px-2 py-0.5 text-xs">
                    sms/phone: {{ client.customerPhone || "-" }}
                  </span>
                </div>
              </td>
              <td class="px-3 py-2 text-slate-700">
                <div>{{ client.contractExpirationDate || "-" }}</div>
                <div class="text-xs text-slate-500">{{ client.contractExpirationStatus || "-" }}</div>
              </td>
              <td class="px-3 py-2 text-slate-700">
                <div>{{ client.overhaulExpirationDate || "-" }}</div>
                <div class="text-xs text-slate-500">{{ client.overhaulExpirationStatus || "-" }}</div>
              </td>
              <td class="px-3 py-2 text-slate-700">
                <span v-if="client.gasSensorExpirationDate">
                  {{ client.gasSensorExpirationDate }} ({{ client.gasSensorPeriodMonths || "-" }} mo)
                </span>
                <span v-else>-</span>
                <span class="block text-xs text-slate-500">{{ client.gasSensorExpirationStatus || "-" }}</span>
              </td>
              <td class="px-3 py-2">
                <button
                  type="button"
                  data-testid="client-edit-button"
                  class="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  @click="openEditDialog(client)"
                >
                  Edit
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <div
      v-if="isDialogOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-4"
      @click.self="closeDialog"
    >
      <section class="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div class="flex items-center justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <h2 class="text-lg font-semibold text-slate-900">
            {{ dialogMode === "create" ? "New Client" : "Edit Client" }}
          </h2>

          <button
            type="button"
            class="rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
            :disabled="savePending"
            @click="closeDialog"
          >
            Close
          </button>
        </div>

        <div class="flex-1 overflow-y-auto px-6 py-4">
          <label class="space-y-1 text-sm text-slate-700">
            <span>Client name</span>
            <input
              v-model="form.name"
              data-testid="client-form-name"
              type="text"
              class="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-orange-500 focus:outline-none"
            >
          </label>

          <label class="space-y-1 text-sm text-slate-700">
            <span>Primary contact</span>
            <input
              v-model="form.primaryContactName"
              data-testid="client-form-primary-contact"
              type="text"
              class="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-orange-500 focus:outline-none"
            >
          </label>

          <label class="space-y-1 text-sm text-slate-700">
            <span>Counter ID</span>
            <input
              v-model="form.counterId"
              type="text"
              class="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-orange-500 focus:outline-none"
            >
          </label>

          <div class="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3 md:col-span-2">
            <div class="flex items-center justify-between gap-3">
              <h3 class="text-sm font-semibold text-slate-800">Service Address</h3>
              <a
                v-if="serviceAddressMapsUrl"
                :href="serviceAddressMapsUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="text-xs font-medium text-orange-700 hover:text-orange-800 hover:underline"
              >
                Open in Google Maps
              </a>
            </div>

            <label class="space-y-1 text-sm text-slate-700">
              <span>Address line</span>
              <input
                v-model="form.addressLine1"
                data-testid="client-form-address-line1"
                type="text"
                class="w-full rounded-md border border-slate-300 bg-white px-3 py-2 focus:border-orange-500 focus:outline-none"
              >
            </label>

            <div class="grid gap-3 md:grid-cols-2">
              <label class="space-y-1 text-sm text-slate-700">
                <span>City</span>
                <input
                  v-model="form.city"
                  data-testid="client-form-city"
                  type="text"
                  class="w-full rounded-md border border-slate-300 bg-white px-3 py-2 focus:border-orange-500 focus:outline-none"
                >
              </label>

              <label class="space-y-1 text-sm text-slate-700">
                <span>Country</span>
                <input
                  v-model="form.country"
                  data-testid="client-form-country"
                  type="text"
                  class="w-full rounded-md border border-slate-300 bg-white px-3 py-2 focus:border-orange-500 focus:outline-none"
                >
              </label>
            </div>
          </div>

          <div class="grid gap-3 md:grid-cols-2">
            <label class="space-y-1 text-sm text-slate-700">
              <span>Customer email</span>
              <input
                v-model="form.customerEmail"
                data-testid="client-form-customer-email"
                type="email"
                placeholder="name@example.com"
                class="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-orange-500 focus:outline-none"
              >
            </label>

            <label class="space-y-1 text-sm text-slate-700">
              <span>Customer sms/phone</span>
              <input
                v-model="form.customerPhone"
                data-testid="client-form-customer-phone"
                type="text"
                placeholder="+40712345678"
                class="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-orange-500 focus:outline-none"
              >
            </label>
          </div>

          <label class="space-y-1 text-sm text-slate-700">
            <span>Contract start date</span>
            <input
              v-model="form.contractStartDate"
              data-testid="client-form-contract-start"
              type="date"
              class="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-orange-500 focus:outline-none"
            >
          </label>

          <div class="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3 md:col-span-2">
            <h3 class="text-sm font-semibold text-slate-800">2Y Flow</h3>
            <div class="grid gap-3 md:grid-cols-2">
              <label class="space-y-1 text-sm text-slate-700">
                <span>Expiration date</span>
                <input
                  v-model="form.contractExpirationDate"
                  data-testid="client-form-contract-expiration"
                  type="date"
                  class="w-full rounded-md border border-slate-300 bg-white px-3 py-2 focus:border-orange-500 focus:outline-none"
                >
              </label>
              <label class="space-y-1 text-sm text-slate-700">
                <span>Status</span>
                <select
                  v-model="form.contractExpirationStatus"
                  class="w-full rounded-md border border-slate-300 bg-white px-3 py-2 focus:border-orange-500 focus:outline-none"
                >
                  <option value="active">active</option>
                  <option value="expiring_soon">expiring_soon</option>
                  <option value="expired">expired</option>
                  <option value="renewed">renewed</option>
                </select>
              </label>
            </div>
          </div>

          <div class="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3 md:col-span-2">
            <h3 class="text-sm font-semibold text-slate-800">10Y Overhaul</h3>
            <div class="grid gap-3 md:grid-cols-2">
              <label class="space-y-1 text-sm text-slate-700">
                <span>Expiration date</span>
                <input
                  v-model="form.overhaulExpirationDate"
                  type="date"
                  class="w-full rounded-md border border-slate-300 bg-white px-3 py-2 focus:border-orange-500 focus:outline-none"
                >
              </label>
              <label class="space-y-1 text-sm text-slate-700">
                <span>Status</span>
                <select
                  v-model="form.overhaulExpirationStatus"
                  class="w-full rounded-md border border-slate-300 bg-white px-3 py-2 focus:border-orange-500 focus:outline-none"
                >
                  <option value="active">active</option>
                  <option value="expiring_soon">expiring_soon</option>
                  <option value="expired">expired</option>
                  <option value="renewed">renewed</option>
                </select>
              </label>
            </div>
          </div>

          <div class="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3 md:col-span-2">
            <h3 class="text-sm font-semibold text-slate-800">Gas Sensor</h3>
            <div class="grid gap-3 md:grid-cols-3">
              <label class="space-y-1 text-sm text-slate-700">
                <span>Expiration date</span>
                <input
                  v-model="form.gasSensorExpirationDate"
                  type="date"
                  class="w-full rounded-md border border-slate-300 bg-white px-3 py-2 focus:border-orange-500 focus:outline-none"
                >
              </label>
              <label class="space-y-1 text-sm text-slate-700">
                <span>Status</span>
                <select
                  v-model="form.gasSensorExpirationStatus"
                  class="w-full rounded-md border border-slate-300 bg-white px-3 py-2 focus:border-orange-500 focus:outline-none"
                >
                  <option value="active">active</option>
                  <option value="expiring_soon">expiring_soon</option>
                  <option value="expired">expired</option>
                  <option value="renewed">renewed</option>
                </select>
              </label>
              <label class="space-y-1 text-sm text-slate-700">
                <span>Period (months)</span>
                <input
                  v-model="form.gasSensorPeriodMonths"
                  type="number"
                  min="1"
                  max="240"
                  class="w-full rounded-md border border-slate-300 bg-white px-3 py-2 focus:border-orange-500 focus:outline-none"
                >
              </label>
            </div>
          </div>
        </div>

        <p
          v-if="formError"
          class="mt-3 px-6 text-sm text-red-600"
        >
          {{ formError }}
        </p>

        <div class="mt-auto border-t border-slate-200 px-6 py-4">
          <div class="flex items-center justify-between gap-3">
            <button
              v-if="dialogMode === 'edit' && editingClientId"
              type="button"
              data-testid="client-dialog-delete-button"
              class="rounded-md border border-rose-300 px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="savePending"
              @click="openDeleteDialog({ _id: editingClientId, name: form.name || 'this client' })"
            >
              Delete Client
            </button>
            <div
              v-else
              class="w-0"
            />

            <div class="flex items-center gap-3">
              <button
                type="button"
                class="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="savePending"
                @click="closeDialog"
              >
                Cancel
              </button>

              <button
                type="button"
                data-testid="client-form-save"
                class="inline-flex items-center rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="savePending"
                @click="saveClient"
              >
                {{ savePending ? (dialogMode === "create" ? "Creating..." : "Saving...") : "Save" }}
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>

    <div
      v-if="deleteClientTarget"
      data-testid="client-delete-modal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-4"
      @click.self="closeDeleteDialog"
    >
      <section class="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div class="border-b border-slate-200 px-6 py-4">
          <h2 class="text-lg font-semibold text-slate-900">Delete Client</h2>
        </div>

        <div class="space-y-3 px-6 py-4 text-sm text-slate-700">
          <p>
            Delete <strong>{{ deleteClientTarget.name }}</strong>?
          </p>
          <p>
            This only works when the client has no related jobs. Notification history will be kept.
          </p>
        </div>

        <div class="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            data-testid="client-delete-cancel"
            class="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="deletePending"
            @click="closeDeleteDialog"
          >
            Cancel
          </button>

          <button
            type="button"
            data-testid="client-delete-confirm"
            class="rounded-md bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="deletePending"
            @click="deleteClient"
          >
            {{ deletePending ? "Deleting..." : "Delete Client" }}
          </button>
        </div>
      </section>
    </div>
  </div>
</template>
