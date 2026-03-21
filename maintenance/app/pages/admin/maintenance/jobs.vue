<script setup lang="ts">
interface MaintenanceJob {
  _id: string;
  clientId: string;
  jobType: "check_2y" | "overhaul_10y" | "gas_sensor_change";
  clientName: string | null;
  contractExpirationDate: string | null;
  clientCheckupIntervalMonths: number | null;
  scheduledFor: string;
  appointmentAt: string | null;
  reservationNotes: string | null;
  status: "pending" | "scheduled" | "done" | "rejected" | "canceled_by_customer";
  assignedTo: string | null;
  clientServiceAddress: {
    line1: string;
    city?: string | null;
    country?: string | null;
  } | null;
  clientPhone: string | null;
}

type JobListFilter = "pending" | "scheduled" | "archived";

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
const scheduleConfirmOpen = ref(false);
const scheduleJobId = ref<string | null>(null);
const scheduleAppointmentAt = ref("");
const scheduleReservationNotes = ref("");
const cancelConfirmOpen = ref(false);
const cancelJobId = ref<string | null>(null);
const rescheduleConfirmOpen = ref(false);
const rescheduleJobId = ref<string | null>(null);
const rescheduleNewDateTime = ref("");
const listFilter = ref<JobListFilter>("pending");
const searchQuery = ref("");
const assigningJobId = ref<string | null>(null);

interface AuthUser {
  name: string;
  roles: string[];
}

interface CurrentUser {
  name?: string;
  roles?: string[];
}

const {
  data: currentUserData,
} = await useAsyncData(
  "maintenance-current-user",
  () =>
    $fetch<CurrentUser>("/api/login", {
      headers: requestHeaders,
      credentials: "include",
    }).catch(() => ({ roles: [] })),
  {
    default: () => ({ roles: [] }),
  },
);

const isAdmin = computed(() =>
  Array.isArray(currentUserData.value?.roles) &&
  currentUserData.value!.roles!.includes("admin"),
);

watch(
  isAdmin,
  (admin) => {
    if (!admin) {
      listFilter.value = "scheduled";
    }
  },
  { immediate: true },
);

const {
  data: usersData,
} = await useAsyncData(
  "maintenance-employees",
  () =>
    $fetch<{ users: AuthUser[] }>("/api/users", {
      headers: requestHeaders,
      credentials: "include",
    }).catch(() => ({ users: [] })),
  {
    default: () => ({ users: [] }),
  },
);

const employees = computed(() =>
  (usersData.value?.users ?? []).filter((u) => u.roles.includes("employee")),
);

const selectedStatusQuery = computed(() => {
  if (!isAdmin.value) {
    return "scheduled";
  }

  if (listFilter.value === "pending") {
    return "pending";
  }

  if (listFilter.value === "scheduled") {
    return "scheduled";
  }

  return "done,rejected,canceled_by_customer";
});

const isPendingFilter = computed(() => listFilter.value === "pending");
const isScheduledFilter = computed(() => listFilter.value === "scheduled");

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

watch([listFilter, isAdmin], async () => {
  actionError.value = null;
  actionSuccess.value = null;
  closeDoneConfirmation();
  closeScheduleConfirmation();
  closeCancelConfirmation();
  await refreshJobs();
});

const getGoogleMapsUrl = (address: { line1?: string | null; city?: string | null; country?: string | null } | null) => {
  if (!address?.line1) return null;
  const parts = [address.line1, address.city, address.country].filter(Boolean);
  const query = encodeURIComponent(parts.join(", "));
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
};

const addMonthsToTodayIso = (months: number): string => {
  const now = new Date();
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  date.setUTCMonth(date.getUTCMonth() + months);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getJobTypeLabel = (jobType: MaintenanceJob["jobType"]): string => {
  if (jobType === "overhaul_10y") {
    return "10y overhaul";
  }
  if (jobType === "gas_sensor_change") {
    return "Gas sensor";
  }
  return "2y check";
};

const canScheduleReservation = (job: MaintenanceJob): boolean => {
  return isAdmin.value && job.status === "pending";
};

const canCustomerCancel = (job: MaintenanceJob): boolean => {
  return isAdmin.value && job.status === "scheduled";
};

const canRescheduleDueDate = (job: MaintenanceJob): boolean => {
  return isAdmin.value && job.status === "pending";
};

const canMarkDone = (job: MaintenanceJob): boolean => {
  if (job.status !== "pending" && job.status !== "scheduled") {
    return false;
  }

  if (isAdmin.value) {
    return true;
  }

  return job.assignedTo === currentUserData.value?.name;
};

const canReject = (job: MaintenanceJob): boolean => {
  return canMarkDone(job);
};

const openDoneConfirmation = (job: MaintenanceJob) => {
  if (job.jobType !== "check_2y") {
    void setJobStatus(job._id, "done");
    return;
  }

  doneJobId.value = job._id;
  const months = 24;
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

const openScheduleConfirmation = (job: MaintenanceJob) => {
  scheduleJobId.value = job._id;
  scheduleAppointmentAt.value = (job.appointmentAt ?? job.scheduledFor).slice(0, 16) || "";
  scheduleReservationNotes.value = job.reservationNotes ?? "";
  scheduleConfirmOpen.value = true;
};

const closeScheduleConfirmation = () => {
  scheduleConfirmOpen.value = false;
  scheduleJobId.value = null;
  scheduleAppointmentAt.value = "";
  scheduleReservationNotes.value = "";
};

const openCancelConfirmation = (jobId: string) => {
  cancelJobId.value = jobId;
  cancelConfirmOpen.value = true;
};

const closeCancelConfirmation = () => {
  cancelConfirmOpen.value = false;
  cancelJobId.value = null;
};

const openRescheduleConfirmation = (job: MaintenanceJob) => {
  rescheduleJobId.value = job._id;
  rescheduleNewDateTime.value = job.scheduledFor.slice(0, 16) || "";
  rescheduleConfirmOpen.value = true;
};

const closeRescheduleConfirmation = () => {
  rescheduleConfirmOpen.value = false;
  rescheduleJobId.value = null;
  rescheduleNewDateTime.value = "";
};

const assignEmployee = async (jobId: string, employeeName: string | null) => {
  if (!isAdmin.value || actionPendingId.value) {
    return;
  }

  actionPendingId.value = jobId;
  actionError.value = null;
  actionSuccess.value = null;

  try {
    await $fetch(
      `/api/maintenance/jobs/${encodeURIComponent(jobId)}/assign`,
      {
        method: "PATCH",
        credentials: "include",
        body: {
          assignedTo: employeeName,
        },
      },
    );

    actionSuccess.value = employeeName
      ? `Job assigned to ${employeeName}.`
      : "Job unassigned.";
    assigningJobId.value = null;
    await refreshJobs();
  } catch (error: any) {
    actionError.value =
      error?.data?.statusMessage || error?.message || "Failed to assign employee.";
  } finally {
    actionPendingId.value = null;
  }
};

const confirmReschedule = async () => {
  if (!rescheduleJobId.value || !rescheduleNewDateTime.value) {
    actionError.value = "New date and time are required.";
    return;
  }

  if (actionPendingId.value) {
    return;
  }

  actionPendingId.value = rescheduleJobId.value;
  actionError.value = null;
  actionSuccess.value = null;

  try {
    const scheduledFor = new Date(rescheduleNewDateTime.value).toISOString();
    await $fetch(
      `/api/maintenance/jobs/${encodeURIComponent(rescheduleJobId.value)}/reschedule`,
      {
        method: "PATCH",
        credentials: "include",
        body: {
          scheduledFor,
        },
      },
    );

    actionSuccess.value = `Job due date moved to ${rescheduleNewDateTime.value}.`;
    closeRescheduleConfirmation();
    await refreshJobs();
  } catch (error: any) {
    actionError.value =
      error?.data?.statusMessage || error?.message || "Failed to reschedule job.";
  } finally {
    actionPendingId.value = null;
  }
};

const setJobStatus = async (
  jobId: string,
  status: "scheduled" | "canceled_by_customer" | "done" | "rejected",
  options?: { nextExpirationDate?: string; appointmentAt?: string; reservationNotes?: string },
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
        ...(status === "scheduled"
          ? {
              appointmentAt: options?.appointmentAt,
              reservationNotes: options?.reservationNotes,
            }
          : {}),
      },
    });

    if (status === "done") {
      actionSuccess.value = `Job marked done. Next expires date set to ${options?.nextExpirationDate}.`;
      closeDoneConfirmation();
    } else if (status === "rejected") {
      actionSuccess.value = "Job moved to rejected.";
      closeRejectConfirmation();
    } else if (status === "scheduled") {
      actionSuccess.value = "Reservation scheduled successfully.";
      closeScheduleConfirmation();
    } else {
      actionSuccess.value = "Job marked canceled by customer.";
      closeCancelConfirmation();
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

const confirmSchedule = async () => {
  if (!scheduleJobId.value || !scheduleAppointmentAt.value) {
    actionError.value = "Reservation appointment date and time are required.";
    return;
  }

  await setJobStatus(scheduleJobId.value, "scheduled", {
    appointmentAt: new Date(scheduleAppointmentAt.value).toISOString(),
    reservationNotes: scheduleReservationNotes.value,
  });
};

const confirmCustomerCancel = async () => {
  if (!cancelJobId.value) {
    return;
  }

  await setJobStatus(cancelJobId.value, "canceled_by_customer");
};
</script>

<template>
  <div class="space-y-6">
    <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h1 class="text-2xl font-semibold text-slate-900">Maintenance Reservations</h1>
      <p class="mt-2 text-sm text-slate-600">
        Admin schedules appointments and assigns workers. Employees see their scheduled assignments.
      </p>
    </section>

    <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div
          v-if="isAdmin"
          class="flex items-center gap-2 rounded-full bg-slate-100 p-1"
        >
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
            Pending
          </button>
          <button
            type="button"
            class="rounded-full px-4 py-1.5 text-sm font-medium transition-colors"
            :class="
              listFilter === 'scheduled'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            "
            @click="listFilter = 'scheduled'"
          >
            Scheduled
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
            Archived
          </button>
        </div>

        <p
          v-else
          class="text-sm text-slate-600"
        >
          Showing your assigned scheduled reservations.
        </p>

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
            : isScheduledFilter
              ? "No scheduled jobs found."
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
              <th class="px-3 py-2 font-medium">Type</th>
              <th class="px-3 py-2 font-medium">Address</th>
              <th class="px-3 py-2 font-medium">Due date</th>
              <th class="px-3 py-2 font-medium">Appointment</th>
              <th class="px-3 py-2 font-medium">Assigned</th>
              <th class="px-3 py-2 font-medium">Status</th>
              <th class="px-3 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr
              v-for="job in filteredJobs"
              :key="job._id"
            >
              <td class="px-3 py-2 text-slate-900">
                <div>{{ job.clientName || job.clientId }}</div>
                <div
                  v-if="job.clientPhone"
                  class="text-xs text-slate-500"
                >
                  {{ job.clientPhone }}
                </div>
              </td>
              <td class="px-3 py-2 text-slate-700">{{ getJobTypeLabel(job.jobType) }}</td>
              <td class="px-3 py-2">
                <a
                  v-if="getGoogleMapsUrl(job.clientServiceAddress)"
                  :href="getGoogleMapsUrl(job.clientServiceAddress)"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-blue-600 hover:underline"
                >
                  {{ job.clientServiceAddress?.line1 || "-" }}
                </a>
                <span v-else>{{ job.clientServiceAddress?.line1 || "-" }}</span>
                <div
                  v-if="job.clientServiceAddress?.city || job.clientServiceAddress?.country"
                  class="text-xs text-slate-500"
                >
                  {{ [job.clientServiceAddress?.city, job.clientServiceAddress?.country].filter(Boolean).join(", ") }}
                </div>
              </td>
              <td class="px-3 py-2 text-slate-700">{{ job.scheduledFor }}</td>
              <td class="px-3 py-2 text-slate-700">
                <div>{{ job.appointmentAt || "-" }}</div>
                <div
                  v-if="job.reservationNotes"
                  class="max-w-xs truncate text-xs text-slate-500"
                >
                  {{ job.reservationNotes }}
                </div>
              </td>
              <td class="px-3 py-2">
                <select
                  v-if="isAdmin && (job.status === 'pending' || job.status === 'scheduled')"
                  :value="job.assignedTo || ''"
                  class="w-full rounded-md border border-slate-300 px-2 py-1 text-xs focus:border-orange-500 focus:outline-none"
                  :disabled="Boolean(actionPendingId && assigningJobId === job._id)"
                  @click="assigningJobId = job._id"
                  @change="assignEmployee(job._id, ($event.target as HTMLSelectElement).value || null)"
                >
                  <option value="">
                    Unassigned
                  </option>
                  <option
                    v-for="emp in employees"
                    :key="emp.name"
                    :value="emp.name"
                  >
                    {{ emp.name }}
                  </option>
                </select>
                <span
                  v-else
                  class="text-sm text-slate-700"
                >{{ job.assignedTo || "-" }}</span>
              </td>
              <td class="px-3 py-2 text-slate-700">{{ job.status }}</td>
              <td class="px-3 py-2">
                <div class="flex flex-wrap gap-2">
                  <button
                    v-if="canScheduleReservation(job)"
                    type="button"
                    class="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                    :disabled="Boolean(actionPendingId)"
                    @click="openScheduleConfirmation(job)"
                  >
                    Schedule
                  </button>
                  <button
                    v-if="canMarkDone(job)"
                    type="button"
                    class="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                    :disabled="Boolean(actionPendingId)"
                    @click="openDoneConfirmation(job)"
                  >
                    {{ actionPendingId === job._id ? "Saving..." : "Mark done" }}
                  </button>
                  <button
                    v-if="canReject(job)"
                    type="button"
                    class="rounded-md bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                    :disabled="Boolean(actionPendingId)"
                    @click="openRejectConfirmation(job._id)"
                  >
                    {{ actionPendingId === job._id ? "Saving..." : "Reject" }}
                  </button>
                  <button
                    v-if="canCustomerCancel(job)"
                    type="button"
                    class="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
                    :disabled="Boolean(actionPendingId)"
                    @click="openCancelConfirmation(job._id)"
                  >
                    Customer canceled
                  </button>
                  <button
                    v-if="canRescheduleDueDate(job)"
                    type="button"
                    class="rounded-md bg-slate-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                    :disabled="Boolean(actionPendingId)"
                    @click="openRescheduleConfirmation(job)"
                  >
                    Move due date
                  </button>
                  <span
                    v-if="!canScheduleReservation(job) && !canMarkDone(job) && !canReject(job) && !canCustomerCancel(job) && !canRescheduleDueDate(job)"
                    class="text-xs text-slate-500"
                  >
                    -
                  </span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <div
      v-if="scheduleConfirmOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-4"
      @click.self="closeScheduleConfirmation"
    >
      <section class="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <h3 class="text-lg font-semibold text-slate-900">
          Schedule Reservation
        </h3>
        <p class="mt-2 text-sm text-slate-600">
          Confirm appointment date and optional notes from the customer call.
        </p>

        <label class="mt-4 block space-y-1 text-sm text-slate-700">
          <span>Appointment date and time</span>
          <input
            v-model="scheduleAppointmentAt"
            type="datetime-local"
            class="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
          >
        </label>

        <label class="mt-4 block space-y-1 text-sm text-slate-700">
          <span>Reservation notes</span>
          <textarea
            v-model="scheduleReservationNotes"
            rows="4"
            class="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
            placeholder="Access notes, call remarks, customer preferences..."
          ></textarea>
        </label>

        <div class="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            class="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            :disabled="Boolean(actionPendingId)"
            @click="closeScheduleConfirmation"
          >
            Cancel
          </button>
          <button
            type="button"
            class="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="Boolean(actionPendingId)"
            @click="confirmSchedule"
          >
            {{ actionPendingId === scheduleJobId ? "Saving..." : "Confirm Reservation" }}
          </button>
        </div>
      </section>
    </div>

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
          Choose the next 2-year check due date for this client.
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

    <div
      v-if="cancelConfirmOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-4"
      @click.self="closeCancelConfirmation"
    >
      <section class="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <h3 class="text-lg font-semibold text-slate-900">
          Confirm Customer Cancelation
        </h3>
        <p class="mt-2 text-sm text-slate-600">
          This will close the scheduled reservation as canceled by customer.
        </p>

        <div class="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            class="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            :disabled="Boolean(actionPendingId)"
            @click="closeCancelConfirmation"
          >
            Back
          </button>
          <button
            type="button"
            class="inline-flex items-center rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="Boolean(actionPendingId)"
            @click="confirmCustomerCancel"
          >
            {{ actionPendingId === cancelJobId ? "Saving..." : "Confirm Cancelation" }}
          </button>
        </div>
      </section>
    </div>

    <div
      v-if="rescheduleConfirmOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-4"
      @click.self="closeRescheduleConfirmation"
    >
      <section class="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <h3 class="text-lg font-semibold text-slate-900">
          Move Due Date
        </h3>
        <p class="mt-2 text-sm text-slate-600">
          Update the auto-generated due date before scheduling the reservation.
        </p>

        <div class="mt-4">
          <input
            v-model="rescheduleNewDateTime"
            type="datetime-local"
            class="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
          >
        </div>

        <div class="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            class="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            :disabled="Boolean(actionPendingId)"
            @click="closeRescheduleConfirmation"
          >
            Cancel
          </button>
          <button
            type="button"
            class="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="Boolean(actionPendingId)"
            @click="confirmReschedule"
          >
            {{ actionPendingId === rescheduleJobId ? "Saving..." : "Confirm" }}
          </button>
        </div>
      </section>
    </div>
  </div>
</template>
