import type {
  MaintenanceClientDocument,
  MaintenanceJobDocument,
  MaintenanceJobType,
  MaintenanceNotificationDocument,
} from "./types";

export interface MaintenanceDashboardCheckPreview {
  clientId: string;
  clientName: string;
  checkType: MaintenanceJobType;
  expirationDate: string;
}

export interface MaintenanceDashboardJobPreview {
  jobId: string;
  clientId: string;
  clientName: string | null;
  jobType: MaintenanceJobType;
  assignedTo: string | null;
  scheduledFor: string;
  appointmentAt: string | null;
}

export interface MaintenanceDashboardNotificationPreview {
  notificationId: string;
  relatedId: string;
  recipient: string;
  channel: "email" | "sms";
  recipientRole: "company" | "customer";
  createdAt: string;
  errorMessage: string | null;
}

export interface MaintenanceDashboardSummary {
  alerts: {
    expiredChecksTotal: number;
    failedCustomerDeliveriesTotal: number;
    failedNotificationsTotal: number;
    unassignedPendingJobsTotal: number;
  };
  today: {
    scheduledTodayTotal: number;
    scheduledTodayByEmployee: Array<{
      employeeName: string;
      count: number;
    }>;
    pendingJobsTotal: number;
  };
  upcoming: {
    check2yExpiringSoonTotal: number;
    overhaul10yExpiringSoonTotal: number;
    gasSensorExpiringSoonTotal: number;
  };
  previews: {
    expiredChecks: MaintenanceDashboardCheckPreview[];
    pendingJobs: MaintenanceDashboardJobPreview[];
    failedNotifications: MaintenanceDashboardNotificationPreview[];
  };
}

interface BuildSummaryInput {
  clients: MaintenanceClientDocument[];
  jobs: MaintenanceJobDocument[];
  notifications: MaintenanceNotificationDocument[];
  failedCustomerClientIds: Set<string>;
  todayDate?: string;
}

const PREVIEW_LIMIT = 5;

const getLocalTodayDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const compareDateAsc = (left: string, right: string) => left.localeCompare(right);
const compareDateDesc = (left: string, right: string) => right.localeCompare(left);

export const buildMaintenanceDashboardSummary = ({
  clients,
  jobs,
  notifications,
  failedCustomerClientIds,
  todayDate = getLocalTodayDate(),
}: BuildSummaryInput): MaintenanceDashboardSummary => {
  const clientNames = new Map(clients.map((client) => [client._id, client.name]));

  const expiredChecks = clients
    .flatMap((client) => {
      const checks: MaintenanceDashboardCheckPreview[] = [];

      if (client.contractExpirationStatus === "expired" && client.contractExpirationDate) {
        checks.push({
          clientId: client._id,
          clientName: client.name,
          checkType: "check_2y",
          expirationDate: client.contractExpirationDate,
        });
      }

      if (client.overhaulExpirationStatus === "expired" && client.overhaulExpirationDate) {
        checks.push({
          clientId: client._id,
          clientName: client.name,
          checkType: "overhaul_10y",
          expirationDate: client.overhaulExpirationDate,
        });
      }

      if (client.gasSensorExpirationStatus === "expired" && client.gasSensorExpirationDate) {
        checks.push({
          clientId: client._id,
          clientName: client.name,
          checkType: "gas_sensor_change",
          expirationDate: client.gasSensorExpirationDate,
        });
      }

      return checks;
    })
    .sort((left, right) => compareDateAsc(left.expirationDate, right.expirationDate));

  const pendingJobs = jobs
    .filter((job) => job.status === "pending")
    .sort((left, right) => compareDateAsc(left.scheduledFor, right.scheduledFor))
    .map((job) => ({
      jobId: job._id,
      clientId: job.clientId,
      clientName: clientNames.get(job.clientId) ?? null,
      jobType: job.jobType,
      assignedTo: job.assignedTo,
      scheduledFor: job.scheduledFor,
      appointmentAt: job.appointmentAt,
    }));

  const failedNotifications = notifications
    .filter((notification) => notification.status === "failed")
    .sort((left, right) => compareDateDesc(left.createdAt, right.createdAt))
    .map((notification) => ({
      notificationId: notification._id,
      relatedId: notification.relatedId,
      recipient: notification.recipient,
      channel: notification.channel,
      recipientRole: notification.recipientRole,
      createdAt: notification.createdAt,
      errorMessage: notification.errorMessage,
    }));

  const scheduledTodayJobs = jobs.filter(
    (job) => job.status === "scheduled" && job.scheduledFor === todayDate,
  );

  const employeeCounts = new Map<string, number>();
  for (const job of scheduledTodayJobs) {
    if (!job.assignedTo) {
      continue;
    }
    employeeCounts.set(job.assignedTo, (employeeCounts.get(job.assignedTo) ?? 0) + 1);
  }

  return {
    alerts: {
      expiredChecksTotal: expiredChecks.length,
      failedCustomerDeliveriesTotal: failedCustomerClientIds.size,
      failedNotificationsTotal: failedNotifications.length,
      unassignedPendingJobsTotal: pendingJobs.filter((job) => !job.assignedTo).length,
    },
    today: {
      scheduledTodayTotal: scheduledTodayJobs.length,
      scheduledTodayByEmployee: Array.from(employeeCounts.entries())
        .map(([employeeName, count]) => ({ employeeName, count }))
        .sort((left, right) => left.employeeName.localeCompare(right.employeeName)),
      pendingJobsTotal: pendingJobs.length,
    },
    upcoming: {
      check2yExpiringSoonTotal: clients.filter(
        (client) => client.contractExpirationStatus === "expiring_soon",
      ).length,
      overhaul10yExpiringSoonTotal: clients.filter(
        (client) => client.overhaulExpirationStatus === "expiring_soon",
      ).length,
      gasSensorExpiringSoonTotal: clients.filter(
        (client) => client.gasSensorExpirationStatus === "expiring_soon",
      ).length,
    },
    previews: {
      expiredChecks: expiredChecks.slice(0, PREVIEW_LIMIT),
      pendingJobs: pendingJobs.slice(0, PREVIEW_LIMIT),
      failedNotifications: failedNotifications.slice(0, PREVIEW_LIMIT),
    },
  };
};
