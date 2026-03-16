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
  primaryContactName: string | null;
  serviceAddress: {
    line1: string;
    city?: string | null;
    country?: string | null;
  };
  contacts: MaintenanceContact[];
}

definePageMeta({
  layout: "admin-workspace",
  middleware: ["role-auth"],
  authAllowedRoles: ["admin"],
});

useHead({
  title: "Maintenance Clients",
});

const requestHeaders = process.server ? useRequestHeaders(["cookie"]) : undefined;
const createPending = ref(false);
const createError = ref<string | null>(null);
const createSuccess = ref<string | null>(null);

const form = reactive({
  name: "",
  primaryContactName: "",
  addressLine1: "",
  city: "",
  country: "",
  contactEmail: "",
  contactSms: "",
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
};

const createClient = async () => {
  if (!form.name.trim() || !form.addressLine1.trim()) {
    createError.value = "Name and service address are required.";
    return;
  }

  const contacts: Array<Record<string, unknown>> = [];
  if (form.contactEmail.trim()) {
    contacts.push({
      channel: "email",
      value: form.contactEmail,
      purpose: "customer",
      active: true,
    });
  }
  if (form.contactSms.trim()) {
    contacts.push({
      channel: "sms",
      value: form.contactSms,
      purpose: "customer",
      active: true,
    });
  }

  if (!contacts.length) {
    createError.value = "At least one email or SMS contact is required.";
    return;
  }

  createPending.value = true;
  createError.value = null;
  createSuccess.value = null;

  try {
    await $fetch("/api/maintenance/clients", {
      method: "POST",
      credentials: "include",
      body: {
        name: form.name,
        primaryContactName: form.primaryContactName,
        serviceAddress: {
          line1: form.addressLine1,
          city: form.city || null,
          country: form.country || null,
        },
        contacts,
      },
    });

    createSuccess.value = "Client created successfully.";
    resetForm();
    await refreshClients();
  } catch (error: any) {
    createError.value =
      error?.data?.statusMessage || error?.message || "Failed to create client.";
  } finally {
    createPending.value = false;
  }
};
</script>

<template>
  <div class="space-y-6">
    <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h1 class="text-2xl font-semibold text-slate-900">Clients</h1>
      <p class="mt-2 text-sm text-slate-600">
        Manage customer records and contact methods used for maintenance notifications.
      </p>
    </section>

    <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 class="text-lg font-semibold text-slate-900">Add Client</h2>
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
        @click="createClient"
      >
        {{ createPending ? "Creating..." : "Create client" }}
      </button>
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
              <th class="px-3 py-2 font-medium">Status</th>
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
              <td class="px-3 py-2">
                <span class="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
                  {{ client.status }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>
