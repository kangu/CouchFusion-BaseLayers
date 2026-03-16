<script setup lang="ts">
interface MaintenanceJob {
  _id: string;
  clientId: string;
  contractId: string;
  clientName: string | null;
  contractExpirationDate: string | null;
  scheduledFor: string;
  status: "pending" | "done" | "rejected";
}

definePageMeta({
  layout: "admin-workspace",
  middleware: ["role-auth"],
  authAllowedRoles: ["admin", "employee"],
});

useHead({
  title: "Maintenance Jobs",
});

const requestHeaders = process.server ? useRequestHeaders(["cookie"]) : undefined;
const actionPendingId = ref<string | null>(null);
const actionError = ref<string | null>(null);
const actionSuccess = ref<string | null>(null);

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
        status: "pending",
      },
      headers: requestHeaders,
      credentials: "include",
    }),
  {
    default: () => ({ jobs: [], total: 0 }),
  },
);

const jobs = computed(() => jobsData.value?.jobs ?? []);

const setJobStatus = async (jobId: string, status: "done" | "rejected") => {
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
      },
    });

    actionSuccess.value = `Job moved to ${status}.`;
    await refreshJobs();
  } catch (error: any) {
    actionError.value =
      error?.data?.statusMessage || error?.message || "Failed to update job status.";
  } finally {
    actionPendingId.value = null;
  }
};
</script>

<template>
  <div class="space-y-6">
    <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h1 class="text-2xl font-semibold text-slate-900">In-Progress Jobs</h1>
      <p class="mt-2 text-sm text-slate-600">
        Employees can close pending jobs as done or rejected. Done jobs auto-schedule a
        new checkup using the configured month interval.
      </p>
    </section>

    <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div class="flex items-center justify-between gap-4">
        <h2 class="text-lg font-semibold text-slate-900">Pending Jobs</h2>
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
        v-else-if="!jobs.length"
        class="mt-4 rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-600"
      >
        No pending jobs right now.
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
              v-for="job in jobs"
              :key="job._id"
            >
              <td class="px-3 py-2 text-slate-900">{{ job.clientName || job.clientId }}</td>
              <td class="px-3 py-2 text-slate-700">{{ job.scheduledFor }}</td>
              <td class="px-3 py-2 text-slate-700">{{ job.contractExpirationDate || "-" }}</td>
              <td class="px-3 py-2 text-slate-700">{{ job.status }}</td>
              <td class="px-3 py-2">
                <div class="flex flex-wrap gap-2">
                  <button
                    type="button"
                    class="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                    :disabled="Boolean(actionPendingId)"
                    @click="setJobStatus(job._id, 'done')"
                  >
                    {{ actionPendingId === job._id ? "Saving..." : "Mark done" }}
                  </button>
                  <button
                    type="button"
                    class="rounded-md bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                    :disabled="Boolean(actionPendingId)"
                    @click="setJobStatus(job._id, 'rejected')"
                  >
                    {{ actionPendingId === job._id ? "Saving..." : "Reject" }}
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>
