import { createError, defineEventHandler, readBody } from "h3";
import { putDocument } from "#database/utils/couchdb";
import { parseClientContacts } from "../../../utils/contacts";
import {
  parseAddress,
  asClientStatus,
  asOptionalText,
  asRequiredText,
  parseClientContractFields,
} from "../../../utils/parsers";
import { assertMaintenanceRole } from "../../../utils/assert-maintenance-role";
import { ensureMaintenanceDatabase } from "../../../utils/maintenance-db";
import type { MaintenanceClientDocument, MaintenanceJobDocument } from "../../../utils/types";
import { writeMaintenanceAuditEntry } from "../../../utils/audit";

interface ClientCreatePayload {
  name?: unknown;
  status?: unknown;
  serviceAddress?: unknown;
  billingAddress?: unknown;
  primaryContactName?: unknown;
  primaryContactTitle?: unknown;
  notes?: unknown;
  contacts?: unknown;
  contractStartDate?: unknown;
  contractExpirationDate?: unknown;
  contractCheckupIntervalMonths?: unknown;
  contractStatus?: unknown;
}

export default defineEventHandler(async (event) => {
  const actor = await assertMaintenanceRole(event, ["admin"]);
  const payload = await readBody<ClientCreatePayload>(event);

  if (!payload || typeof payload !== "object") {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid payload",
    });
  }

  const serviceAddress = parseAddress(payload.serviceAddress, "serviceAddress");
  if (!serviceAddress) {
    throw createError({
      statusCode: 400,
      statusMessage: "serviceAddress is required",
    });
  }

  const now = new Date().toISOString();
  const contractFields = parseClientContractFields({
    startDate: payload.contractStartDate,
    expirationDate: payload.contractExpirationDate,
    checkupIntervalMonths: payload.contractCheckupIntervalMonths,
    status: payload.contractStatus,
  });

  const client: MaintenanceClientDocument = {
    _id: `maintenance_client:${crypto.randomUUID()}`,
    type: "maintenance_client",
    name: asRequiredText(payload.name, 180, "name"),
    status: asClientStatus(payload.status),
    serviceAddress,
    billingAddress: parseAddress(payload.billingAddress, "billingAddress"),
    primaryContactName: asOptionalText(payload.primaryContactName, 180, "primaryContactName"),
    primaryContactTitle: asOptionalText(payload.primaryContactTitle, 180, "primaryContactTitle"),
    notes: asOptionalText(payload.notes, 5000, "notes"),
    contacts: parseClientContacts(payload.contacts),
    ...contractFields,
    createdAt: now,
    updatedAt: now,
  };

  const databaseName = await ensureMaintenanceDatabase();
  const result = await putDocument(databaseName, client);
  let firstJob: MaintenanceJobDocument | null = null;

  if (client.contractStartDate) {
    firstJob = {
      _id: `maintenance_job:${crypto.randomUUID()}`,
      type: "maintenance_job",
      clientId: client._id,
      scheduledFor: client.contractStartDate,
      status: "pending",
      assignedTo: null,
      completionNotes: null,
      rejectionReason: null,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    await putDocument(databaseName, firstJob);
  }

  await writeMaintenanceAuditEntry({
    databaseName,
    entityType: "client",
    entityId: client._id,
    action: "client_create",
    actor: actor.username,
    previousState: null,
    nextState: {
      name: client.name,
      status: client.status,
      contractExpirationDate: client.contractExpirationDate,
    },
  });

  return {
    success: true,
    id: result.id,
    rev: result.rev,
    client: {
      ...client,
      _rev: result.rev,
    },
    firstJob,
  };
});
