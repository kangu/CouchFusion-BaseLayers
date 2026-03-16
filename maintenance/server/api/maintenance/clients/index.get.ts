import { defineEventHandler, getQuery } from "h3";
import { getView } from "#database/utils/couchdb";
import { assertMaintenanceRole } from "../../../utils/assert-maintenance-role";
import { ensureMaintenanceDatabase } from "../../../utils/maintenance-db";
import type { MaintenanceClientDocument } from "../../../utils/types";

export default defineEventHandler(async (event) => {
  await assertMaintenanceRole(event, ["admin"]);
  const query = getQuery(event);
  const search = String(query.search ?? "").trim().toLowerCase();
  const status = String(query.status ?? "all").trim().toLowerCase();
  const databaseName = await ensureMaintenanceDatabase();

  const view = await getView(databaseName, "maintenance", "clients_by_name", {
    include_docs: true,
    descending: false,
  });

  const clients = (view?.rows ?? [])
    .map((row) => row.doc as MaintenanceClientDocument | undefined)
    .filter(
      (doc): doc is MaintenanceClientDocument =>
        Boolean(doc && doc.type === "maintenance_client"),
    )
    .filter((client) => {
      if (status === "all") {
        return true;
      }
      return client.status === status;
    })
    .filter((client) => {
      if (!search.length) {
        return true;
      }

      const haystack = [
        client.name,
        client.primaryContactName,
        client.serviceAddress?.line1,
        client.serviceAddress?.city,
        client.serviceAddress?.country,
      ]
        .map((value) => String(value ?? "").toLowerCase())
        .join(" ");

      return haystack.includes(search);
    });

  return {
    clients,
    total: clients.length,
  };
});
