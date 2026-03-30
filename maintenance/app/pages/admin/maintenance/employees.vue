<script setup lang="ts">
import { getEmployeeDisplayLabel } from "#maintenance/utils/employee-display";

interface Employee {
  name: string;
  email: string | null;
  fullName: string | null;
  roles: string[];
}

definePageMeta({
  layout: "admin-workspace",
  middleware: ["auth", "role-auth"],
  authAllowedRoles: ["admin"],
});

useHead({
  title: "Maintenance Employees",
});

const requestHeaders = process.server ? useRequestHeaders(["cookie"]) : undefined;
const savePending = ref(false);
const formError = ref<string | null>(null);

const isDialogOpen = ref(false);
const editingEmployee = ref<Employee | null>(null);

const form = reactive({
  username: "",
  email: "",
  fullName: "",
  password: "",
});

const {
  data: employeesData,
  pending: employeesPending,
  error: employeesError,
  refresh: refreshEmployees,
} = await useAsyncData(
  "maintenance-employees",
  () =>
    $fetch<{ employees: Employee[]; total: number }>("/api/maintenance/employees", {
      headers: requestHeaders,
      credentials: "include",
    }),
  {
    default: () => ({ employees: [], total: 0 }),
  },
);

const employees = computed(() => employeesData.value?.employees ?? []);

const getConfig = () => {
  const config = useRuntimeConfig();
  return config.dbLoginPrefix || "gas-";
};

const stripPrefix = (name: string) => {
  const prefix = getConfig();
  return name.startsWith(prefix) ? name.slice(prefix.length) : name;
};

const resetForm = () => {
  form.username = "";
  form.email = "";
  form.fullName = "";
  form.password = "";
  editingEmployee.value = null;
};

const openCreateDialog = () => {
  formError.value = null;
  resetForm();
  isDialogOpen.value = true;
};

const openEditDialog = (employee: Employee) => {
  formError.value = null;
  editingEmployee.value = employee;
  form.username = stripPrefix(employee.name);
  form.email = employee.email ?? "";
  form.fullName = employee.fullName ?? "";
  isDialogOpen.value = true;
};

const closeDialog = () => {
  isDialogOpen.value = false;
  resetForm();
};

const saveEmployee = async () => {
  if (!form.username.trim()) {
    formError.value = "Username is required.";
    return;
  }

  savePending.value = true;
  formError.value = null;

  try {
    if (editingEmployee.value) {
      await $fetch(
        `/api/maintenance/employees/${encodeURIComponent(stripPrefix(editingEmployee.value.name))}`,
        {
          method: "PATCH",
          credentials: "include",
          body: {
            email: form.email.trim() || null,
            fullName: form.fullName.trim() || null,
          },
        },
      );
    } else {
      await $fetch("/api/maintenance/employees", {
        method: "POST",
        credentials: "include",
        body: {
          username: form.username.trim(),
          email: form.email.trim() || null,
          fullName: form.fullName.trim() || null,
          password: form.password || null,
        },
      });
    }

    closeDialog();
    await refreshEmployees();
  } catch (error: any) {
    formError.value =
      error?.data?.statusMessage || error?.message || "Failed to save employee.";
  } finally {
    savePending.value = false;
  }
};

const deleteEmployee = async (employee: Employee) => {
  const employeeLabel = getEmployeeDisplayLabel(employee, stripPrefix(employee.name));
  if (!confirm(`Are you sure you want to delete employee "${employeeLabel}"?`)) {
    return;
  }

  try {
    await $fetch(
      `/api/maintenance/employees/${encodeURIComponent(stripPrefix(employee.name))}`,
      {
        method: "DELETE",
        credentials: "include",
      },
    );
    await refreshEmployees();
  } catch (error: any) {
    alert(error?.data?.statusMessage || error?.message || "Failed to delete employee.");
  }
};
</script>

<template>
  <div class="p-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-semibold text-slate-900">
        Employees
      </h1>
      <button
        type="button"
        class="rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700"
        @click="openCreateDialog"
      >
        Add Employee
      </button>
    </div>

    <p
      v-if="employeesError"
      class="mt-4 text-sm text-red-600"
    >
      Failed to load employees.
    </p>
    <p
      v-else-if="employeesPending"
      class="mt-4 text-sm text-slate-600"
    >
      Loading employees...
    </p>
    <div
      v-else-if="!employees.length"
      class="mt-4 rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-600"
    >
      No employees found.
    </div>

    <div
      v-else
      class="mt-4 overflow-x-auto"
    >
      <table class="min-w-full divide-y divide-slate-200 text-sm">
        <thead class="bg-slate-50 text-left text-slate-600">
          <tr>
            <th class="px-3 py-2 font-medium">Username</th>
            <th class="px-3 py-2 font-medium">Full name</th>
            <th class="px-3 py-2 font-medium">Email</th>
            <th class="px-3 py-2 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr
            v-for="employee in employees"
            :key="stripPrefix(employee.name)"
          >
            <td class="px-3 py-2 text-slate-900">{{ stripPrefix(employee.name) }}</td>
            <td class="px-3 py-2 text-slate-700">{{ employee.fullName || "-" }}</td>
            <td class="px-3 py-2 text-slate-700">{{ employee.email || "-" }}</td>
            <td class="px-3 py-2">
              <div class="flex gap-2">
                <button
                  type="button"
                  class="rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                  @click="openEditDialog(employee)"
                >
                  Edit
                </button>
                <button
                  type="button"
                  class="rounded-md bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-700"
                  @click="deleteEmployee(employee)"
                >
                  Delete
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div
      v-if="isDialogOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-4"
      @click.self="closeDialog"
    >
      <section class="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <h2 class="text-lg font-semibold text-slate-900">
          {{ editingEmployee ? "Edit Employee" : "Add Employee" }}
        </h2>

        <div class="mt-4 space-y-4">
          <label class="block space-y-1 text-sm text-slate-700">
            <span>Username</span>
            <input
              v-model="form.username"
              type="text"
              :disabled="!!editingEmployee"
              class="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-orange-500 focus:outline-none disabled:bg-slate-100"
            >
          </label>

          <label class="block space-y-1 text-sm text-slate-700">
            <span>Full name</span>
            <input
              v-model="form.fullName"
              data-testid="employee-form-full-name"
              type="text"
              class="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-orange-500 focus:outline-none"
            >
          </label>

          <label class="block space-y-1 text-sm text-slate-700">
            <span>Email</span>
            <input
              v-model="form.email"
              type="email"
              class="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-orange-500 focus:outline-none"
            >
          </label>

          <label
            v-if="!editingEmployee"
            class="block space-y-1 text-sm text-slate-700"
          >
            <span>Password</span>
            <input
              v-model="form.password"
              type="password"
              class="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-orange-500 focus:outline-none"
            >
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
            class="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            :disabled="savePending"
            @click="closeDialog"
          >
            Cancel
          </button>
          <button
            type="button"
            class="inline-flex items-center rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="savePending"
            @click="saveEmployee"
          >
            {{ savePending ? "Saving..." : "Save" }}
          </button>
        </div>
      </section>
    </div>
  </div>
</template>
