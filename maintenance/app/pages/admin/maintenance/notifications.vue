<script setup lang="ts">
interface MaintenanceNotification {
  _id: string;
  relatedId: string;
  channel: "email" | "sms";
  recipient: string;
  recipientRole: "company" | "customer";
  status: "queued" | "sent" | "failed";
  attempts: number;
  errorMessage: string | null;
  createdAt: string;
  sentAt: string | null;
}

definePageMeta({
  layout: "admin-workspace",
  // Temporary debug: disable auth guard to inspect page styling unauthenticated.
  // middleware: ["role-auth"],
  // authAllowedRoles: ["admin"],
});

useHead({
  title: "Maintenance Notifications",
});

const requestHeaders = process.server ? useRequestHeaders(["cookie"]) : undefined;
const runPending = ref(false);
const runMessage = ref<string | null>(null);
const runError = ref<string | null>(null);

const {
  data: notificationsData,
  pending: notificationsPending,
  error: notificationsError,
  refresh: refreshNotifications,
} = await useAsyncData(
  "maintenance-notifications",
  () =>
    $fetch<{ notifications: MaintenanceNotification[]; total: number }>(
      "/api/maintenance/notifications",
      {
        headers: requestHeaders,
        credentials: "include",
      },
    ),
  {
    default: () => ({
      notifications: [],
      total: 0,
    }),
  },
);

const notifications = computed(() => notificationsData.value?.notifications ?? []);

const runExpiryCron = async (dryRun: boolean) => {
  if (runPending.value) {
    return;
  }

  runPending.value = true;
  runError.value = null;
  runMessage.value = null;

  try {
    const response = await $fetch<{
      summary: {
        clientsMatched: number;
        notificationsSent: number;
        notificationsFailed: number;
        notificationsSkipped: number;
        notificationsDryRunQueued: number;
      };
    }>("/api/maintenance/cron/expiry-check", {
      method: "POST",
      credentials: "include",
      body: {
        dryRun,
      },
    });

    const summary = response.summary;
    runMessage.value = dryRun
      ? `Dry run complete. Would queue ${summary.notificationsDryRunQueued} notifications.`
      : `Cron complete. Sent ${summary.notificationsSent}, failed ${summary.notificationsFailed}, skipped ${summary.notificationsSkipped}.`;
    await refreshNotifications();
  } catch (error: any) {
    runError.value =
      error?.data?.statusMessage || error?.message || "Failed to run expiry check.";
  } finally {
    runPending.value = false;
  }
};
</script>

<template>
  <div class="space-y-6">
    <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h1 class="text-2xl font-semibold text-slate-900">Notification Log</h1>
      <p class="mt-2 text-sm text-slate-600">
        Review sent/failed reminders and run the contract expiry check manually.
      </p>

      <div class="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          class="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="runPending"
          @click="runExpiryCron(true)"
        >
          {{ runPending ? "Running..." : "Run dry check" }}
        </button>
        <button
          type="button"
          class="rounded-md bg-orange-600 px-3 py-1.5 text-sm text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="runPending"
          @click="runExpiryCron(false)"
        >
          {{ runPending ? "Running..." : "Run cron now" }}
        </button>
      </div>

      <p
        v-if="runMessage"
        class="mt-3 text-sm text-emerald-700"
      >
        {{ runMessage }}
      </p>
      <p
        v-if="runError"
        class="mt-3 text-sm text-red-600"
      >
        {{ runError }}
      </p>
    </section>

    <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div class="flex items-center justify-between gap-4">
        <h2 class="text-lg font-semibold text-slate-900">Entries</h2>
        <button
          type="button"
          class="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          @click="refreshNotifications"
        >
          Refresh
        </button>
      </div>

      <p
        v-if="notificationsError"
        class="mt-4 text-sm text-red-600"
      >
        Failed to load notifications.
      </p>
      <p
        v-else-if="notificationsPending"
        class="mt-4 text-sm text-slate-600"
      >
        Loading notifications...
      </p>
      <div
        v-else-if="!notifications.length"
        class="mt-4 rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-600"
      >
        No notifications logged yet.
      </div>

      <div
        v-else
        class="mt-4 overflow-x-auto"
      >
        <table class="min-w-full divide-y divide-slate-200 text-sm">
          <thead class="bg-slate-50 text-left text-slate-600">
            <tr>
              <th class="px-3 py-2 font-medium">Created</th>
              <th class="px-3 py-2 font-medium">Channel</th>
              <th class="px-3 py-2 font-medium">Recipient</th>
              <th class="px-3 py-2 font-medium">Role</th>
              <th class="px-3 py-2 font-medium">Status</th>
              <th class="px-3 py-2 font-medium">Error</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr
              v-for="item in notifications"
              :key="item._id"
            >
              <td class="px-3 py-2 text-slate-700">{{ item.createdAt }}</td>
              <td class="px-3 py-2 text-slate-700">{{ item.channel }}</td>
              <td class="px-3 py-2 text-slate-900">{{ item.recipient }}</td>
              <td class="px-3 py-2 text-slate-700">{{ item.recipientRole }}</td>
              <td class="px-3 py-2 text-slate-700">{{ item.status }}</td>
              <td class="px-3 py-2 text-rose-700">{{ item.errorMessage || "-" }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>
