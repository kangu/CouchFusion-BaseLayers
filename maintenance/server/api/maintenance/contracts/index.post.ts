import { createError, defineEventHandler, readBody } from "h3";
import { getDocument, putDocument } from "#database/utils/couchdb";
import { ensureIsoDateOnly } from "../../../utils/dates";
import {
  asContractStatus,
  asOptionalPositiveInteger,
  asOptionalText,
  asRequiredText,
} from "../../../utils/parsers";
import { assertMaintenanceRole } from "../../../utils/assert-maintenance-role";
import { ensureMaintenanceDatabase } from "../../../utils/maintenance-db";
import type {
  MaintenanceClientDocument,
  MaintenanceContractDocument,
  MaintenanceJobDocument,
} from "../../../utils/types";
import { writeMaintenanceAuditEntry } from "../../../utils/audit";

interface ContractCreatePayload {
  clientId?: unknown;
  startDate?: unknown;
  expirationDate?: unknown;
  checkupIntervalMonths?: unknown;
  status?: unknown;
  notes?: unknown;
}

export default defineEventHandler(async (event) => {
  const actor = await assertMaintenanceRole(event, ["admin"]);
  const payload = await readBody<ContractCreatePayload>(event);

  if (!payload || typeof payload !== "object") {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid payload",
    });
  }

  const databaseName = await ensureMaintenanceDatabase();
  const clientId = asRequiredText(payload.clientId, 220, "clientId");
  const client = await getDocument<MaintenanceClientDocument>(databaseName, clientId);

  if (!client || client.type !== "maintenance_client") {
    throw createError({
      statusCode: 404,
      statusMessage: "Client not found",
    });
  }

  const now = new Date().toISOString();
  const contract: MaintenanceContractDocument = {
    _id: `maintenance_contract:${crypto.randomUUID()}`,
    type: "maintenance_contract",
    clientId,
    startDate: ensureIsoDateOnly(payload.startDate, "startDate"),
    expirationDate: ensureIsoDateOnly(payload.expirationDate, "expirationDate"),
    checkupIntervalMonths: asOptionalPositiveInteger(
      payload.checkupIntervalMonths,
      "checkupIntervalMonths",
    ),
    status: asContractStatus(payload.status),
    notes: asOptionalText(payload.notes, 5000, "notes"),
    createdAt: now,
    updatedAt: now,
  };

  const contractResult = await putDocument(databaseName, contract);

  const firstJob: MaintenanceJobDocument = {
    _id: `maintenance_job:${crypto.randomUUID()}`,
    type: "maintenance_job",
    clientId,
    contractId: contract._id,
    scheduledFor: contract.startDate,
    status: "pending",
    assignedTo: null,
    completionNotes: null,
    rejectionReason: null,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  const firstJobResult = await putDocument(databaseName, firstJob);

  await writeMaintenanceAuditEntry({
    databaseName,
    entityType: "contract",
    entityId: contract._id,
    action: "contract_create",
    actor: actor.username,
    previousState: null,
    nextState: {
      status: contract.status,
      expirationDate: contract.expirationDate,
    },
  });

  await writeMaintenanceAuditEntry({
    databaseName,
    entityType: "job",
    entityId: firstJob._id,
    action: "job_create_from_contract",
    actor: actor.username,
    previousState: null,
    nextState: {
      status: firstJob.status,
      scheduledFor: firstJob.scheduledFor,
    },
  });

  return {
    success: true,
    contract: {
      ...contract,
      _rev: contractResult.rev,
    },
    firstJob: {
      ...firstJob,
      _rev: firstJobResult.rev,
    },
  };
});
