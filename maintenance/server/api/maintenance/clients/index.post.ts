import { createError, defineEventHandler, readBody } from "h3";
import { putDocument } from "#database/utils/couchdb";
import { parseClientContacts } from "../../../utils/contacts";
import { parseAddress, asClientStatus, asOptionalText, asRequiredText } from "../../../utils/parsers";
import { assertMaintenanceRole } from "../../../utils/assert-maintenance-role";
import { ensureMaintenanceDatabase } from "../../../utils/maintenance-db";
import type { MaintenanceClientDocument } from "../../../utils/types";
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
    createdAt: now,
    updatedAt: now,
  };

  const databaseName = await ensureMaintenanceDatabase();
  const result = await putDocument(databaseName, client);

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
  };
});
