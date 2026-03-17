import { defineEventHandler, getQuery } from "h3";
import { getView } from "#database/utils/couchdb";
import { assertMaintenanceRole } from "../../../utils/assert-maintenance-role";
import { ensureMaintenanceDatabase } from "../../../utils/maintenance-db";
import type { MaintenanceNotificationDocument } from "../../../utils/types";

export default defineEventHandler(async (event) => {
  await assertMaintenanceRole(event, ["admin"]);
  const query = getQuery(event);
  const status = String(query.status ?? "all").trim().toLowerCase();
  const channel = String(query.channel ?? "all").trim().toLowerCase();
  const databaseName = await ensureMaintenanceDatabase();

  const view = await getView(databaseName, "maintenance", "notifications_by_created_at", {
    include_docs: true,
    descending: true,
    limit: 500,
  });

  const notifications = (view?.rows ?? [])
    .map((row) => row.doc as MaintenanceNotificationDocument | undefined)
    .filter(
      (doc): doc is MaintenanceNotificationDocument =>
        Boolean(doc && doc.type === "maintenance_notification"),
    )
    .filter((notification) => {
      if (status === "all") {
        return true;
      }
      return notification.status === status;
    })
    .filter((notification) => {
      if (channel === "all") {
        return true;
      }
      return notification.channel === channel;
    });

  return {
    notifications,
    total: notifications.length,
  };
});
