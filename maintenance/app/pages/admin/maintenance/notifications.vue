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
  middleware: ["auth", "role-auth"],
  authAllowedRoles: ["admin"],
});

useHead({
  title: "Maintenance Notifications",
});

const requestHeaders = process.server ? useRequestHeaders(["cookie"]) : undefined;
const runPending = ref(false);
const runMessage = ref<string | null>(null);
const runError = ref<string | null>(null);
const pastExpiryConfirmOpen = ref(false);
const pendingRunDryMode = ref(false);

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

const runExpiryCron = async (dryRun: boolean, pastExpiredAction?: "include" | "skip") => {
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
        jobsCreated: number;
        jobsDryRunQueued: number;
        jobsSkippedExistingPending: number;
        pastExpiredClientsFound: number;
        requiresPastExpiredDecision: boolean;
      };
    }>("/api/maintenance/cron/expiry-check", {
      method: "POST",
      credentials: "include",
      body: {
        dryRun,
        ...(pastExpiredAction ? { pastExpiredAction } : {}),
      },
    });

    const summary = response.summary;
    if (summary.requiresPastExpiredDecision) {
      pendingRunDryMode.value = dryRun;
      pastExpiryConfirmOpen.value = true;
      runMessage.value =
        `Found ${summary.pastExpiredClientsFound} client(s) with past expiration date. ` +
        "Choose whether to include them.";
      return;
    }

    runMessage.value = dryRun
      ? `Dry run complete. Jobs to create: ${summary.jobsDryRunQueued}, notifications to queue: ${summary.notificationsDryRunQueued}.`
      : `Cron complete. Jobs created ${summary.jobsCreated} (skipped existing pending: ${summary.jobsSkippedExistingPending}). ` +
        `Notifications sent ${summary.notificationsSent}, failed ${summary.notificationsFailed}, skipped ${summary.notificationsSkipped}.`;
    await refreshNotifications();
  } catch (error: any) {
    runError.value =
      error?.data?.statusMessage || error?.message || "Failed to run expiry check.";
  } finally {
    runPending.value = false;
  }
};

const closePastExpiryConfirm = () => {
  if (runPending.value) {
    return;
  }
  pastExpiryConfirmOpen.value = false;
};

const confirmPastExpiryAction = async (action: "include" | "skip") => {
  pastExpiryConfirmOpen.value = false;
  await runExpiryCron(pendingRunDryMode.value, action);
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
          data-testid="notifications-run-dry"
          class="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="runPending"
          @click="runExpiryCron(true)"
        >
          {{ runPending ? "Running..." : "Run dry check" }}
        </button>
        <button
          type="button"
          data-testid="notifications-run-now"
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

    <div
      v-if="pastExpiryConfirmOpen"
      data-testid="notifications-past-expired-modal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-4"
      @click.self="closePastExpiryConfirm"
    >
      <section class="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <h3 class="text-lg font-semibold text-slate-900">
          Past Expiration Dates Found
        </h3>
        <p class="mt-2 text-sm text-slate-600">
          Some clients have expiration dates in the past. Include them for job creation now?
        </p>

        <div class="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            data-testid="notifications-past-expired-skip"
            class="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            :disabled="runPending"
            @click="confirmPastExpiryAction('skip')"
          >
            Skip Past Expired
          </button>
          <button
            type="button"
            data-testid="notifications-past-expired-include"
            class="inline-flex items-center rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="runPending"
            @click="confirmPastExpiryAction('include')"
          >
            Include Past Expired
          </button>
        </div>
      </section>
    </div>

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
              data-testid="notification-row"
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
