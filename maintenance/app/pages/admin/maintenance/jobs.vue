<script setup lang="ts">
interface MaintenanceJob {
  _id: string;
  clientId: string;
  clientName: string | null;
  contractExpirationDate: string | null;
  clientCheckupIntervalMonths: number | null;
  scheduledFor: string;
  status: "pending" | "done" | "rejected";
}
type JobListFilter = "pending" | "archived";

definePageMeta({
  layout: "admin-workspace",
  middleware: ["auth", "role-auth"],
  authAllowedRoles: ["admin", "employee"],
});

useHead({
  title: "Maintenance Jobs",
});

const requestHeaders = process.server ? useRequestHeaders(["cookie"]) : undefined;
const actionPendingId = ref<string | null>(null);
const actionError = ref<string | null>(null);
const actionSuccess = ref<string | null>(null);
const doneConfirmOpen = ref(false);
const doneJobId = ref<string | null>(null);
const doneNextExpirationDate = ref("");
const rejectConfirmOpen = ref(false);
const rejectJobId = ref<string | null>(null);
const listFilter = ref<JobListFilter>("pending");
const searchQuery = ref("");

const selectedStatusQuery = computed(() =>
  listFilter.value === "pending" ? "pending" : "done,rejected",
);
const isPendingFilter = computed(() => listFilter.value === "pending");

const {
  data: jobsData,
  pending: jobsPending,
  error: jobsError,
  refresh: refreshJobs,
} = await useAsyncData(
  "maintenance-jobs",
  () =>
    $fetch<{ jobs: MaintenanceJob[]; total: number }>("/api/maintenance/jobs", {
      query: {
        status: selectedStatusQuery.value,
      },
      headers: requestHeaders,
      credentials: "include",
    }),
  {
    default: () => ({ jobs: [], total: 0 }),
  },
);

const jobs = computed(() => jobsData.value?.jobs ?? []);
const filteredJobs = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  if (!query.length) {
    return jobs.value;
  }
  return jobs.value.filter((job) =>
    String(job.clientName ?? "").toLowerCase().includes(query),
  );
});

watch(listFilter, async () => {
  actionError.value = null;
  actionSuccess.value = null;
  closeDoneConfirmation();
  await refreshJobs();
});

const addMonthsToTodayIso = (months: number): string => {
  const now = new Date();
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  date.setUTCMonth(date.getUTCMonth() + months);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const openDoneConfirmation = (job: MaintenanceJob) => {
  doneJobId.value = job._id;
  const months = job.clientCheckupIntervalMonths && job.clientCheckupIntervalMonths > 0
    ? job.clientCheckupIntervalMonths
    : 6;
  doneNextExpirationDate.value = addMonthsToTodayIso(months);
  doneConfirmOpen.value = true;
};

const closeDoneConfirmation = () => {
  doneConfirmOpen.value = false;
  doneJobId.value = null;
  doneNextExpirationDate.value = "";
};

const openRejectConfirmation = (jobId: string) => {
  rejectJobId.value = jobId;
  rejectConfirmOpen.value = true;
};

const closeRejectConfirmation = () => {
  rejectConfirmOpen.value = false;
  rejectJobId.value = null;
};

const setJobStatus = async (
  jobId: string,
  status: "done" | "rejected",
  options?: { nextExpirationDate?: string },
) => {
  if (actionPendingId.value) {
    return;
  }

  actionPendingId.value = jobId;
  actionError.value = null;
  actionSuccess.value = null;

  try {
    await $fetch(`/api/maintenance/jobs/${encodeURIComponent(jobId)}/status`, {
      method: "PATCH",
      credentials: "include",
      body: {
        status,
        ...(status === "done" ? { nextExpirationDate: options?.nextExpirationDate } : {}),
      },
    });

    actionSuccess.value =
      status === "done"
        ? `Job marked done. Next expires date set to ${options?.nextExpirationDate}.`
        : `Job moved to ${status}.`;
    if (status === "done") {
      closeDoneConfirmation();
    }
    if (status === "rejected") {
      closeRejectConfirmation();
    }
    await refreshJobs();
  } catch (error: any) {
    actionError.value =
      error?.data?.statusMessage || error?.message || "Failed to update job status.";
  } finally {
    actionPendingId.value = null;
  }
};

const confirmMarkDone = async () => {
  if (!doneJobId.value || !doneNextExpirationDate.value) {
    actionError.value = "Next expires date is required.";
    return;
  }
  await setJobStatus(doneJobId.value, "done", {
    nextExpirationDate: doneNextExpirationDate.value,
  });
};

const confirmReject = async () => {
  if (!rejectJobId.value) {
    return;
  }
  await setJobStatus(rejectJobId.value, "rejected");
};
</script>

<template>
  <div class="space-y-6">
    <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h1 class="text-2xl font-semibold text-slate-900">In-Progress Jobs</h1>
      <p class="mt-2 text-sm text-slate-600">
        Employees can close pending jobs as done or rejected. Marking done requires selecting the
        next expiration date.
      </p>
    </section>

    <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div class="flex items-center gap-2 rounded-full bg-slate-100 p-1">
          <button
            type="button"
            class="rounded-full px-4 py-1.5 text-sm font-medium transition-colors"
            :class="
              listFilter === 'pending'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            "
            @click="listFilter = 'pending'"
          >
            Pending Jobs
          </button>
          <button
            type="button"
            class="rounded-full px-4 py-1.5 text-sm font-medium transition-colors"
            :class="
              listFilter === 'archived'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            "
            @click="listFilter = 'archived'"
          >
            Archived Jobs
          </button>
        </div>

        <div class="flex items-center gap-2">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search by client name"
            class="w-64 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-orange-500 focus:outline-none"
          >
        </div>

        <button
          type="button"
          class="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          @click="refreshJobs"
        >
          Refresh
        </button>
      </div>

      <p
        v-if="actionError"
        class="mt-3 text-sm text-red-600"
      >
        {{ actionError }}
      </p>
      <p
        v-if="actionSuccess"
        class="mt-3 text-sm text-emerald-700"
      >
        {{ actionSuccess }}
      </p>

      <p
        v-if="jobsError"
        class="mt-4 text-sm text-red-600"
      >
        Failed to load jobs.
      </p>
      <p
        v-else-if="jobsPending"
        class="mt-4 text-sm text-slate-600"
      >
        Loading jobs...
      </p>
      <div
        v-else-if="!filteredJobs.length"
        class="mt-4 rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-600"
      >
        {{
          isPendingFilter
            ? "No pending jobs found."
            : "No archived jobs found."
        }}
      </div>

      <div
        v-else
        class="mt-4 overflow-x-auto"
      >
        <table class="min-w-full divide-y divide-slate-200 text-sm">
          <thead class="bg-slate-50 text-left text-slate-600">
            <tr>
              <th class="px-3 py-2 font-medium">Client</th>
              <th class="px-3 py-2 font-medium">Scheduled</th>
              <th class="px-3 py-2 font-medium">Contract expires</th>
              <th class="px-3 py-2 font-medium">Status</th>
              <th class="px-3 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr
              v-for="job in filteredJobs"
              :key="job._id"
            >
              <td class="px-3 py-2 text-slate-900">{{ job.clientName || job.clientId }}</td>
              <td class="px-3 py-2 text-slate-700">{{ job.scheduledFor }}</td>
              <td class="px-3 py-2 text-slate-700">{{ job.contractExpirationDate || "-" }}</td>
              <td class="px-3 py-2 text-slate-700">{{ job.status }}</td>
              <td class="px-3 py-2">
                <div
                  v-if="isPendingFilter"
                  class="flex flex-wrap gap-2"
                >
                  <button
                    type="button"
                    class="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                    :disabled="Boolean(actionPendingId)"
                    @click="openDoneConfirmation(job)"
                  >
                    {{ actionPendingId === job._id ? "Saving..." : "Mark done" }}
                  </button>
                  <button
                    type="button"
                    class="rounded-md bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                    :disabled="Boolean(actionPendingId)"
                    @click="openRejectConfirmation(job._id)"
                  >
                    {{ actionPendingId === job._id ? "Saving..." : "Reject" }}
                  </button>
                </div>
                <span
                  v-else
                  class="text-xs text-slate-500"
                >
                  -
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <div
      v-if="doneConfirmOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-4"
      @click.self="closeDoneConfirmation"
    >
      <section class="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <h3 class="text-lg font-semibold text-slate-900">
          Confirm Mark Done
        </h3>
        <p class="mt-2 text-sm text-slate-600">
          Choose the next expires date for this client.
        </p>

        <label class="mt-4 block space-y-1 text-sm text-slate-700">
          <span>Next expires date</span>
          <input
            v-model="doneNextExpirationDate"
            type="date"
            class="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-orange-500 focus:outline-none"
          >
        </label>

        <div class="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            class="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            :disabled="Boolean(actionPendingId)"
            @click="closeDoneConfirmation"
          >
            Cancel
          </button>
          <button
            type="button"
            class="inline-flex items-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="Boolean(actionPendingId)"
            @click="confirmMarkDone"
          >
            {{ actionPendingId === doneJobId ? "Saving..." : "Confirm Done" }}
          </button>
        </div>
      </section>
    </div>

    <div
      v-if="rejectConfirmOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-4"
      @click.self="closeRejectConfirmation"
    >
      <section class="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <h3 class="text-lg font-semibold text-slate-900">
          Confirm Reject
        </h3>
        <p class="mt-2 text-sm text-slate-600">
          Are you sure you want to reject this job?
        </p>

        <div class="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            class="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            :disabled="Boolean(actionPendingId)"
            @click="closeRejectConfirmation"
          >
            Cancel
          </button>
          <button
            type="button"
            class="inline-flex items-center rounded-md bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="Boolean(actionPendingId)"
            @click="confirmReject"
          >
            {{ actionPendingId === rejectJobId ? "Saving..." : "Confirm Reject" }}
          </button>
        </div>
      </section>
    </div>
  </div>
</template>
