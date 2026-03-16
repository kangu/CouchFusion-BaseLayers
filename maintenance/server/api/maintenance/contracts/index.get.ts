import { defineEventHandler, getQuery } from "h3";
import { getView } from "#database/utils/couchdb";
import { assertMaintenanceRole } from "../../../utils/assert-maintenance-role";
import { ensureMaintenanceDatabase } from "../../../utils/maintenance-db";
import type { MaintenanceContractDocument } from "../../../utils/types";

export default defineEventHandler(async (event) => {
  await assertMaintenanceRole(event, ["admin"]);
  const query = getQuery(event);
  const clientId = String(query.clientId ?? "").trim();
  const status = String(query.status ?? "all").trim().toLowerCase();
  const databaseName = await ensureMaintenanceDatabase();

  const view = await getView(databaseName, "maintenance", "contracts_by_expiration_date", {
    include_docs: true,
    descending: false,
  });

  const contracts = (view?.rows ?? [])
    .map((row) => row.doc as MaintenanceContractDocument | undefined)
    .filter(
      (doc): doc is MaintenanceContractDocument =>
        Boolean(doc && doc.type === "maintenance_contract"),
    )
    .filter((contract) => {
      if (!clientId.length) {
        return true;
      }
      return contract.clientId === clientId;
    })
    .filter((contract) => {
      if (status === "all") {
        return true;
      }
      return contract.status === status;
    });

  return {
    contracts,
    total: contracts.length,
  };
});
