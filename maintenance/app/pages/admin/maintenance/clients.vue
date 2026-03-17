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
  status: "active" | "inactive";
  contractStartDate: string | null;
  contractExpirationDate: string | null;
  contractCheckupIntervalMonths: number | null;
  contractStatus: "active" | "expiring_soon" | "expired" | "renewed";
  primaryContactName: string | null;
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
  // Temporary debug: disable auth guard to inspect page styling unauthenticated.
  // middleware: ["role-auth"],
  // authAllowedRoles: ["admin"],
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
const preservedContacts = ref<MaintenanceContact[]>([]);
const customerEmailContactId = ref<string | null>(null);
const customerSmsContactId = ref<string | null>(null);

const form = reactive({
  name: "",
  primaryContactName: "",
  addressLine1: "",
  city: "",
  country: "",
  contactEmail: "",
  contactSms: "",
  contractStartDate: "",
  contractExpirationDate: "",
  contractCheckupIntervalMonths: "6",
  contractStatus: "active" as "active" | "expiring_soon" | "expired" | "renewed",
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
  form.addressLine1 = "";
  form.city = "";
  form.country = "";
  form.contactEmail = "";
  form.contactSms = "";
  form.contractStartDate = "";
  form.contractExpirationDate = "";
  form.contractCheckupIntervalMonths = "6";
  form.contractStatus = "active";
  editingClientId.value = null;
  preservedContacts.value = [];
  customerEmailContactId.value = null;
  customerSmsContactId.value = null;
};

const openCreateDialog = () => {
  dialogMode.value = "create";
  formError.value = null;
  resetForm();
  isDialogOpen.value = true;
};

const getCustomerContact = (
  contacts: MaintenanceContact[],
  channel: "email" | "sms",
): MaintenanceContact | null => {
  const byChannel = contacts.filter(
    (contact) => contact.channel === channel && contact.purpose === "customer",
  );
  const preferred = byChannel.find((contact) => contact.active !== false);
  return preferred ?? byChannel[0] ?? null;
};

const openEditDialog = (client: MaintenanceClient) => {
  dialogMode.value = "edit";
  formError.value = null;

  const emailContact = getCustomerContact(client.contacts ?? [], "email");
  const smsContact = getCustomerContact(client.contacts ?? [], "sms");

  const managedCustomerIds = new Set<string>(
    [emailContact?.id, smsContact?.id].filter(Boolean) as string[],
  );

  // Keep contacts that are not managed by this simplified modal so they are not lost on patch.
  preservedContacts.value = (client.contacts ?? []).filter(
    (contact) => !managedCustomerIds.has(contact.id),
  );

  customerEmailContactId.value = emailContact?.id ?? null;
  customerSmsContactId.value = smsContact?.id ?? null;

  editingClientId.value = client._id;
  form.name = client.name ?? "";
  form.primaryContactName = client.primaryContactName ?? "";
  form.addressLine1 = client.serviceAddress?.line1 ?? "";
  form.city = client.serviceAddress?.city ?? "";
  form.country = client.serviceAddress?.country ?? "";
  form.contactEmail = emailContact?.value ?? "";
  form.contactSms = smsContact?.value ?? "";
  form.contractStartDate = client.contractStartDate ?? "";
  form.contractExpirationDate = client.contractExpirationDate ?? "";
  form.contractCheckupIntervalMonths = String(client.contractCheckupIntervalMonths ?? 6);
  form.contractStatus = client.contractStatus ?? "active";

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
  const contacts: Array<Record<string, unknown>> = preservedContacts.value.map((contact) => ({
    id: contact.id,
    channel: contact.channel,
    value: contact.value,
    purpose: contact.purpose,
    active: contact.active,
    label: contact.label ?? null,
  }));

  if (form.contactEmail.trim()) {
    contacts.push({
      ...(customerEmailContactId.value ? { id: customerEmailContactId.value } : {}),
      channel: "email",
      value: form.contactEmail,
      purpose: "customer",
      active: true,
    });
  }

  if (form.contactSms.trim()) {
    contacts.push({
      ...(customerSmsContactId.value ? { id: customerSmsContactId.value } : {}),
      channel: "sms",
      value: form.contactSms,
      purpose: "customer",
      active: true,
    });
  }

  return contacts;
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
  if (!contacts.length) {
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
      contractStatus: form.contractStatus,
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
              <th class="px-3 py-2 font-medium">Contract status</th>
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
                <span
                  v-for="contact in client.contacts"
                  :key="contact.id"
                  class="mr-2 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs"
                >
                  {{ contact.channel }}: {{ contact.value }}
                </span>
              </td>
              <td class="px-3 py-2 text-slate-700">
                {{ client.contractExpirationDate || "-" }}
              </td>
              <td class="px-3 py-2 text-slate-700">
                {{ client.contractStatus }}
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
      <section class="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div class="flex items-center justify-between gap-4">
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

        <div class="mt-4 grid gap-4 md:grid-cols-2">
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

          <label class="space-y-1 text-sm text-slate-700">
            <span>Customer email</span>
            <input
              v-model="form.contactEmail"
              type="email"
              class="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-orange-500 focus:outline-none"
            >
          </label>

          <label class="space-y-1 text-sm text-slate-700">
            <span>Customer SMS (E.164)</span>
            <input
              v-model="form.contactSms"
              type="text"
              placeholder="+40712345678"
              class="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-orange-500 focus:outline-none"
            >
          </label>

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
            <span>Contract status</span>
            <select
              v-model="form.contractStatus"
              class="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-orange-500 focus:outline-none"
            >
              <option value="active">active</option>
              <option value="expiring_soon">expiring_soon</option>
              <option value="expired">expired</option>
              <option value="renewed">renewed</option>
            </select>
          </label>
        </div>

        <p
          v-if="formError"
          class="mt-3 text-sm text-red-600"
        >
          {{ formError }}
        </p>

        <div class="mt-5 flex items-center justify-end gap-2">
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
