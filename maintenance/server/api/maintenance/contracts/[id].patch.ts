import {
  createError,
  defineEventHandler,
  getRouterParam,
  readBody,
} from "h3";
import { getDocument, putDocument } from "#database/utils/couchdb";
import { ensureIsoDateOnly } from "../../../utils/dates";
import {
  asContractStatus,
  asOptionalPositiveInteger,
  asOptionalText,
} from "../../../utils/parsers";
import { assertMaintenanceRole } from "../../../utils/assert-maintenance-role";
import { ensureMaintenanceDatabase } from "../../../utils/maintenance-db";
import type { MaintenanceContractDocument } from "../../../utils/types";
import { writeMaintenanceAuditEntry } from "../../../utils/audit";

interface ContractPatchPayload {
  startDate?: unknown;
  expirationDate?: unknown;
  checkupIntervalMonths?: unknown;
  status?: unknown;
  notes?: unknown;
}

export default defineEventHandler(async (event) => {
  const actor = await assertMaintenanceRole(event, ["admin"]);
  const contractId = getRouterParam(event, "id", { decode: true });
  if (!contractId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Contract id is required",
    });
  }

  const payload = await readBody<ContractPatchPayload>(event);
  if (!payload || typeof payload !== "object") {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid payload",
    });
  }

  const databaseName = await ensureMaintenanceDatabase();
  const existingContract = await getDocument<MaintenanceContractDocument>(
    databaseName,
    contractId,
  );

  if (!existingContract || existingContract.type !== "maintenance_contract") {
    throw createError({
      statusCode: 404,
      statusMessage: "Contract not found",
    });
  }

  const nextContract: MaintenanceContractDocument = {
    ...existingContract,
    startDate:
      typeof payload.startDate === "undefined"
        ? existingContract.startDate
        : ensureIsoDateOnly(payload.startDate, "startDate"),
    expirationDate:
      typeof payload.expirationDate === "undefined"
        ? existingContract.expirationDate
        : ensureIsoDateOnly(payload.expirationDate, "expirationDate"),
    checkupIntervalMonths:
      typeof payload.checkupIntervalMonths === "undefined"
        ? existingContract.checkupIntervalMonths
        : asOptionalPositiveInteger(payload.checkupIntervalMonths, "checkupIntervalMonths"),
    status:
      typeof payload.status === "undefined"
        ? existingContract.status
        : asContractStatus(payload.status),
    notes:
      typeof payload.notes === "undefined"
        ? existingContract.notes
        : asOptionalText(payload.notes, 5000, "notes"),
    updatedAt: new Date().toISOString(),
  };

  const result = await putDocument(databaseName, nextContract);

  await writeMaintenanceAuditEntry({
    databaseName,
    entityType: "contract",
    entityId: nextContract._id,
    action: "contract_update",
    actor: actor.username,
    previousState: {
      status: existingContract.status,
      expirationDate: existingContract.expirationDate,
    },
    nextState: {
      status: nextContract.status,
      expirationDate: nextContract.expirationDate,
    },
  });

  return {
    success: true,
    id: result.id,
    rev: result.rev,
    contract: {
      ...nextContract,
      _rev: result.rev,
    },
  };
});
