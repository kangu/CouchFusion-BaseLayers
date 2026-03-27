import {
  createError,
  defineEventHandler,
  getRouterParam,
} from "h3";
import {
  deleteDocument,
  getDocument,
  getView,
} from "#database/utils/couchdb";
import { assertMaintenanceRole } from "../../../utils/assert-maintenance-role";
import { writeMaintenanceAuditEntry } from "../../../utils/audit";
import { ensureMaintenanceDatabase } from "../../../utils/maintenance-db";
import type { MaintenanceClientDocument } from "../../../utils/types";

export default defineEventHandler(async (event) => {
  const actor = await assertMaintenanceRole(event, ["admin"]);
  const clientId = getRouterParam(event, "id", { decode: true });

  if (!clientId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Client id is required",
    });
  }

  const databaseName = await ensureMaintenanceDatabase();
  const existingClient = await getDocument<MaintenanceClientDocument>(
    databaseName,
    clientId,
  );

  if (!existingClient || existingClient.type !== "maintenance_client") {
    throw createError({
      statusCode: 404,
      statusMessage: "Client not found",
    });
  }

  const relatedJobsView = await getView(databaseName, "maintenance", "jobs_by_client", {
    startkey: [clientId],
    endkey: [clientId, {}],
    include_docs: false,
    limit: 1,
  });

  if ((relatedJobsView?.rows?.length ?? 0) > 0) {
    throw createError({
      statusCode: 409,
      statusMessage: "Client cannot be deleted while related jobs exist.",
    });
  }

  await deleteDocument(databaseName, existingClient._id, existingClient._rev);

  await writeMaintenanceAuditEntry({
    databaseName,
    entityType: "client",
    entityId: existingClient._id,
    action: "client_delete",
    actor: actor.username,
    previousState: {
      name: existingClient.name,
      contractExpirationDate: existingClient.contractExpirationDate,
      overhaulExpirationDate: existingClient.overhaulExpirationDate,
      gasSensorExpirationDate: existingClient.gasSensorExpirationDate,
    },
    nextState: null,
  });

  return {
    success: true,
  };
});
