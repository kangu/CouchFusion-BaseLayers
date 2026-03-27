import { defineEventHandler } from "h3";
import { getView } from "#database/utils/couchdb";
import { assertMaintenanceRole } from "../../utils/assert-maintenance-role";
import { ensureMaintenanceDatabase } from "../../utils/maintenance-db";
import { buildMaintenanceDashboardSummary } from "../../utils/dashboard";
import type {
  MaintenanceClientDocument,
  MaintenanceJobDocument,
  MaintenanceNotificationDocument,
} from "../../utils/types";

export default defineEventHandler(async (event) => {
  await assertMaintenanceRole(event, ["admin"]);

  const databaseName = await ensureMaintenanceDatabase();

  const [clientView, jobView, notificationView, failedCustomerNotificationsView] =
    await Promise.all([
      getView(databaseName, "maintenance", "clients_by_name", {
        include_docs: true,
        descending: false,
      }),
      getView(databaseName, "maintenance", "jobs_by_status_scheduled", {
        include_docs: true,
        descending: false,
      }),
      getView(databaseName, "maintenance", "notifications_by_created_at", {
        include_docs: true,
        descending: true,
        limit: 500,
      }),
      getView(databaseName, "maintenance", "notifications_failed_customer_by_client", {
        include_docs: false,
      }),
    ]);

  const clients = (clientView?.rows ?? [])
    .map((row) => row.doc as MaintenanceClientDocument | undefined)
    .filter(
      (doc): doc is MaintenanceClientDocument =>
        Boolean(doc && doc.type === "maintenance_client"),
    );

  const jobs = (jobView?.rows ?? [])
    .map((row) => row.doc as MaintenanceJobDocument | undefined)
    .filter(
      (doc): doc is MaintenanceJobDocument => Boolean(doc && doc.type === "maintenance_job"),
    );

  const notifications = (notificationView?.rows ?? [])
    .map((row) => row.doc as MaintenanceNotificationDocument | undefined)
    .filter(
      (doc): doc is MaintenanceNotificationDocument =>
        Boolean(doc && doc.type === "maintenance_notification"),
    );

  const failedCustomerClientIds = new Set(
    (failedCustomerNotificationsView?.rows ?? [])
      .map((row) => String(row?.key ?? "").trim())
      .filter(Boolean),
  );

  return buildMaintenanceDashboardSummary({
    clients,
    jobs,
    notifications,
    failedCustomerClientIds,
  });
});
