<script setup lang="ts">
interface MaintenanceContact {
  id: string;
  channel: "email" | "sms";
  value: string;
  purpose: "company" | "customer" | "billing" | "technical";
  active: boolean;
  label?: string | null;
}

interface MaintenanceClient {
  _id: string;
  name: string;
  status: "active" | "expiring_soon" | "expired" | "renewed" | "discontinued";
  contractStartDate: string | null;
  contractExpirationDate: string | null;
  contractCheckupIntervalMonths: number | null;
  primaryContactName: string | null;
  counterId: string | null;
  serviceAddress: {
    line1: string;
    city?: string | null;
    country?: string | null;
  };
  contacts: MaintenanceContact[];
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
const savePending = ref(false);
const formError = ref<string | null>(null);
const actionSuccess = ref<string | null>(null);

const isDialogOpen = ref(false);
const dialogMode = ref<ClientDialogMode>("create");
const editingClientId = ref<string | null>(null);
const editableContacts = ref<MaintenanceContact[]>([]);

const contactPurposeOptions: MaintenanceContact["purpose"][] = [
  "customer",
  "company",
  "billing",
  "technical",
];

const form = reactive({
  name: "",
  primaryContactName: "",
  counterId: "",
  addressLine1: "",
  city: "",
  country: "",
  contractStartDate: "",
  contractExpirationDate: "",
  contractCheckupIntervalMonths: "6",
  status: "active" as "active" | "expiring_soon" | "expired" | "renewed" | "discontinued",
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

const resetForm = () => {
  form.name = "";
  form.primaryContactName = "";
  form.counterId = "";
  form.addressLine1 = "";
  form.city = "";
  form.country = "";
  form.contractStartDate = "";
  form.contractExpirationDate = "";
  form.contractCheckupIntervalMonths = "6";
  form.status = "active";
  editingClientId.value = null;
  editableContacts.value = [
    {
      id: crypto.randomUUID(),
      channel: "email",
      value: "",
      purpose: "customer",
      active: true,
      label: null,
    },
  ];
};

const openCreateDialog = () => {
  dialogMode.value = "create";
  formError.value = null;
  resetForm();
  isDialogOpen.value = true;
};

const openEditDialog = (client: MaintenanceClient) => {
  dialogMode.value = "edit";
  formError.value = null;

  editingClientId.value = client._id;
  form.name = client.name ?? "";
  form.primaryContactName = client.primaryContactName ?? "";
  form.counterId = client.counterId ?? "";
  form.addressLine1 = client.serviceAddress?.line1 ?? "";
  form.city = client.serviceAddress?.city ?? "";
  form.country = client.serviceAddress?.country ?? "";
  form.contractStartDate = client.contractStartDate ?? "";
  form.contractExpirationDate = client.contractExpirationDate ?? "";
  form.contractCheckupIntervalMonths = String(client.contractCheckupIntervalMonths ?? 6);
  form.status = client.status ?? "active";
  editableContacts.value = (client.contacts ?? []).map((contact) => ({
    id: contact.id || crypto.randomUUID(),
    channel: contact.channel,
    value: contact.value,
    purpose: contact.purpose,
    active: true,
    label: contact.label ?? null,
  })).filter((contact) => contact.value.trim().length > 0);
  if (!editableContacts.value.length) {
    editableContacts.value = [
      {
        id: crypto.randomUUID(),
        channel: "email",
        value: "",
        purpose: "customer",
        active: true,
        label: null,
      },
    ];
  }

  isDialogOpen.value = true;
};

const closeDialog = () => {
  if (savePending.value) {
    return;
  }
  isDialogOpen.value = false;
  formError.value = null;
};

const buildContactsPayload = (): Array<Record<string, unknown>> => {
  return editableContacts.value.map((contact) => ({
    id: contact.id,
    channel: contact.channel,
    value: contact.value,
    purpose: contact.purpose,
    active: true,
    label: contact.label ?? null,
  }));
};

const addContactMethod = () => {
  editableContacts.value.push({
    id: crypto.randomUUID(),
    channel: "email",
    value: "",
    purpose: "customer",
    active: true,
    label: null,
  });
};

const removeContactMethod = (id: string) => {
  editableContacts.value = editableContacts.value.filter((contact) => contact.id !== id);
};

const saveClient = async () => {
  if (!form.name.trim() || !form.addressLine1.trim()) {
    formError.value = "Name and service address are required.";
    return;
  }

  if ((form.contractStartDate && !form.contractExpirationDate) || (!form.contractStartDate && form.contractExpirationDate)) {
    formError.value = "Contract start and expiration dates must be provided together.";
    return;
  }

  if (form.contractStartDate) {
    const interval = Number.parseInt(form.contractCheckupIntervalMonths, 10);
    if (!Number.isInteger(interval) || interval <= 0) {
      formError.value = "Checkup interval must be a positive integer.";
      return;
    }
  }

  const contacts = buildContactsPayload();
  if (!contacts.length || !contacts.some((contact) => String(contact.value ?? "").trim().length > 0)) {
    formError.value = "At least one contact method is required.";
    return;
  }

  savePending.value = true;
  formError.value = null;
  actionSuccess.value = null;

  try {
    const body = {
      name: form.name,
      primaryContactName: form.primaryContactName,
      counterId: form.counterId || null,
      serviceAddress: {
        line1: form.addressLine1,
        city: form.city || null,
        country: form.country || null,
      },
      contacts,
      contractStartDate: form.contractStartDate || null,
      contractExpirationDate: form.contractExpirationDate || null,
      contractCheckupIntervalMonths: form.contractStartDate
        ? Number.parseInt(form.contractCheckupIntervalMonths, 10)
        : null,
      status: form.status,
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
</script>

<template>
  <div class="space-y-6">
    <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div class="flex items-center justify-between gap-4">
        <div>
          <h1 class="text-2xl font-semibold text-slate-900">Clients</h1>
          <p class="mt-2 text-sm text-slate-600">
            Manage customer records, contact methods and contract lifecycle in one place.
          </p>
        </div>

        <button
          type="button"
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
              <th class="px-3 py-2 font-medium">Contacts</th>
              <th class="px-3 py-2 font-medium">Contract expires</th>
              <th class="px-3 py-2 font-medium">Status</th>
              <th class="px-3 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr
              v-for="client in clients"
              :key="client._id"
            >
              <td class="px-3 py-2 text-slate-900">{{ client.name }}</td>
              <td class="px-3 py-2 text-slate-700">{{ client.primaryContactName || "-" }}</td>
              <td class="px-3 py-2 text-slate-700">
                {{ client.serviceAddress.line1 }}
                <span v-if="client.serviceAddress.city">, {{ client.serviceAddress.city }}</span>
              </td>
              <td class="px-3 py-2 text-slate-700">
                <div class="flex flex-col items-start gap-1">
                  <span
                    v-for="contact in client.contacts"
                    :key="contact.id"
                    class="mr-2 inline-flex flex-col rounded-full bg-slate-100 px-2 py-0.5 text-xs"
                  >
                    {{ contact.channel }}: {{ contact.value }}
                  </span>
                </div>
              </td>
              <td class="px-3 py-2 text-slate-700">
                {{ client.contractExpirationDate || "-" }}
              </td>
              <td class="px-3 py-2">
                <span class="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
                  {{ client.status }}
                </span>
              </td>
              <td class="px-3 py-2">
                <button
                  type="button"
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
              type="text"
              class="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-orange-500 focus:outline-none"
            >
          </label>

          <label class="space-y-1 text-sm text-slate-700">
            <span>Primary contact</span>
            <input
              v-model="form.primaryContactName"
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

          <label class="space-y-1 text-sm text-slate-700 md:col-span-2">
            <span>Service address</span>
            <input
              v-model="form.addressLine1"
              type="text"
              class="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-orange-500 focus:outline-none"
            >
          </label>

          <label class="space-y-1 text-sm text-slate-700">
            <span>City</span>
            <input
              v-model="form.city"
              type="text"
              class="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-orange-500 focus:outline-none"
            >
          </label>

          <label class="space-y-1 text-sm text-slate-700">
            <span>Country</span>
            <input
              v-model="form.country"
              type="text"
              class="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-orange-500 focus:outline-none"
            >
          </label>

          <div class="space-y-3 text-sm text-slate-700 md:col-span-2">
            <div class="flex items-center justify-between gap-3">
              <span class="font-medium">Contact methods</span>
              <button
                type="button"
                class="rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                @click="addContactMethod"
              >
                Add method
              </button>
            </div>

            <div
              v-for="contact in editableContacts"
              :key="contact.id"
              class="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5 md:grid-cols-12"
            >
              <label class="space-y-1 md:col-span-2">
                <span>Channel</span>
                <select
                  v-model="contact.channel"
                  class="w-full rounded-md border border-slate-300 bg-white px-2 py-2 focus:border-orange-500 focus:outline-none"
                >
                  <option value="email">email</option>
                  <option value="sms">sms</option>
                </select>
              </label>

              <label class="space-y-1 md:col-span-3">
                <span>Purpose</span>
                <select
                  v-model="contact.purpose"
                  class="w-full rounded-md border border-slate-300 bg-white px-2 py-2 focus:border-orange-500 focus:outline-none"
                >
                  <option
                    v-for="purpose in contactPurposeOptions"
                    :key="purpose"
                    :value="purpose"
                  >
                    {{ purpose }}
                  </option>
                </select>
              </label>

              <label class="space-y-1 md:col-span-5">
                <span>Value</span>
                <input
                  v-model="contact.value"
                  :type="contact.channel === 'email' ? 'email' : 'text'"
                  :placeholder="contact.channel === 'sms' ? '+40712345678' : 'name@example.com'"
                  class="w-full rounded-md border border-slate-300 bg-white px-2 py-2 focus:border-orange-500 focus:outline-none"
                >
              </label>

              <div class="flex items-end justify-end gap-2 md:col-span-2">
                <button
                  type="button"
                  class="rounded-md border border-rose-300 px-2 py-1.5 text-xs text-rose-700 hover:bg-rose-50"
                  :disabled="editableContacts.length === 1"
                  @click="removeContactMethod(contact.id)"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>

          <label class="space-y-1 text-sm text-slate-700">
            <span>Contract start date</span>
            <input
              v-model="form.contractStartDate"
              type="date"
              class="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-orange-500 focus:outline-none"
            >
          </label>

          <label class="space-y-1 text-sm text-slate-700">
            <span>Contract expiration date</span>
            <input
              v-model="form.contractExpirationDate"
              type="date"
              class="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-orange-500 focus:outline-none"
            >
          </label>

          <label class="space-y-1 text-sm text-slate-700">
            <span>Checkup interval (months)</span>
            <input
              v-model="form.contractCheckupIntervalMonths"
              type="number"
              min="1"
              max="24"
              class="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-orange-500 focus:outline-none"
            >
          </label>

          <label class="space-y-1 text-sm text-slate-700">
            <span>Status</span>
            <select
              v-model="form.status"
              class="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-orange-500 focus:outline-none"
            >
              <option value="active">active</option>
              <option value="expiring_soon">expiring_soon</option>
              <option value="expired">expired</option>
              <option value="renewed">renewed</option>
              <option value="discontinued">discontinued</option>
            </select>
          </label>
        </div>

        <p
          v-if="formError"
          class="mt-3 px-6 text-sm text-red-600"
        >
          {{ formError }}
        </p>

        <div class="mt-auto border-t border-slate-200 px-6 py-4">
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
            class="inline-flex items-center rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="savePending"
            @click="saveClient"
          >
            {{ savePending ? (dialogMode === "create" ? "Creating..." : "Saving...") : "Save" }}
          </button>
        </div>
      </section>
    </div>
  </div>
</template>
