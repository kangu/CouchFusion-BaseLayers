import {
  createError,
  defineEventHandler,
  getRouterParam,
  readBody,
} from "h3";
import { getDocument, putDocument } from "#database/utils/couchdb";
import { parseClientContacts } from "../../../utils/contacts";
import {
  asClientStatus,
  asOptionalText,
  asRequiredText,
  parseClientContractFields,
  parseAddress,
  parseClientScheduleFields,
} from "../../../utils/parsers";
import { assertMaintenanceRole } from "../../../utils/assert-maintenance-role";
import { ensureMaintenanceDatabase } from "../../../utils/maintenance-db";
import type { MaintenanceClientDocument } from "../../../utils/types";
import { writeMaintenanceAuditEntry } from "../../../utils/audit";

interface ClientPatchPayload {
  name?: unknown;
  status?: unknown;
  serviceAddress?: unknown;
  billingAddress?: unknown;
  primaryContactName?: unknown;
  primaryContactTitle?: unknown;
  counterId?: unknown;
  notes?: unknown;
  contacts?: unknown;
  contractStartDate?: unknown;
  contractExpirationDate?: unknown;
  contractCheckupIntervalMonths?: unknown;
  overhaulBaseDate?: unknown;
  gasSensorBaseDate?: unknown;
  gasSensorPeriodMonths?: unknown;
}

export default defineEventHandler(async (event) => {
  const actor = await assertMaintenanceRole(event, ["admin"]);
  const clientId = getRouterParam(event, "id", { decode: true });
  if (!clientId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Client id is required",
    });
  }

  const payload = await readBody<ClientPatchPayload>(event);
  if (!payload || typeof payload !== "object") {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid payload",
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

  const contractFields = parseClientContractFields({
    startDate:
      typeof payload.contractStartDate === "undefined"
        ? existingClient.contractStartDate
        : payload.contractStartDate,
    expirationDate:
      typeof payload.contractExpirationDate === "undefined"
        ? existingClient.contractExpirationDate
        : payload.contractExpirationDate,
    checkupIntervalMonths:
      typeof payload.contractCheckupIntervalMonths === "undefined"
        ? existingClient.contractCheckupIntervalMonths
        : payload.contractCheckupIntervalMonths,
  });
  const scheduleFields = parseClientScheduleFields({
    overhaulBaseDate:
      typeof payload.overhaulBaseDate === "undefined"
        ? existingClient.overhaulBaseDate
        : payload.overhaulBaseDate,
    gasSensorBaseDate:
      typeof payload.gasSensorBaseDate === "undefined"
        ? existingClient.gasSensorBaseDate
        : payload.gasSensorBaseDate,
    gasSensorPeriodMonths:
      typeof payload.gasSensorPeriodMonths === "undefined"
        ? existingClient.gasSensorPeriodMonths
        : payload.gasSensorPeriodMonths,
  });

  const nextClient: MaintenanceClientDocument = {
    ...existingClient,
    name:
      typeof payload.name === "undefined"
        ? existingClient.name
        : asRequiredText(payload.name, 180, "name"),
    status:
      typeof payload.status === "undefined"
        ? existingClient.status
        : asClientStatus(payload.status),
    serviceAddress:
      typeof payload.serviceAddress === "undefined"
        ? existingClient.serviceAddress
        : parseAddress(payload.serviceAddress, "serviceAddress") ||
          existingClient.serviceAddress,
    billingAddress:
      typeof payload.billingAddress === "undefined"
        ? existingClient.billingAddress
        : parseAddress(payload.billingAddress, "billingAddress"),
    primaryContactName:
      typeof payload.primaryContactName === "undefined"
        ? existingClient.primaryContactName
        : asOptionalText(payload.primaryContactName, 180, "primaryContactName"),
    primaryContactTitle:
      typeof payload.primaryContactTitle === "undefined"
        ? existingClient.primaryContactTitle
        : asOptionalText(payload.primaryContactTitle, 180, "primaryContactTitle"),
    counterId:
      typeof payload.counterId === "undefined"
        ? existingClient.counterId
        : asOptionalText(payload.counterId, 50, "counterId"),
    notes:
      typeof payload.notes === "undefined"
        ? existingClient.notes
        : asOptionalText(payload.notes, 5000, "notes"),
    contacts:
      typeof payload.contacts === "undefined"
        ? existingClient.contacts
        : parseClientContacts(payload.contacts),
    ...contractFields,
    ...scheduleFields,
    updatedAt: new Date().toISOString(),
  };

  const result = await putDocument(databaseName, nextClient);

  await writeMaintenanceAuditEntry({
    databaseName,
    entityType: "client",
    entityId: nextClient._id,
    action: "client_update",
    actor: actor.username,
    previousState: {
      status: existingClient.status,
      name: existingClient.name,
    },
    nextState: {
      status: nextClient.status,
      name: nextClient.name,
      contractExpirationDate: nextClient.contractExpirationDate,
    },
  });

  return {
    success: true,
    id: result.id,
    rev: result.rev,
    client: {
      ...nextClient,
      _rev: result.rev,
    },
  };
});
