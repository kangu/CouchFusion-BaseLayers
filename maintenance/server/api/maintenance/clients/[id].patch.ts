import {
  createError,
  defineEventHandler,
  getRouterParam,
  readBody,
} from "h3";
import { getDocument, putDocument } from "#database/utils/couchdb";
import {
  parseClientContacts,
  resolveCustomerContacts,
} from "../../../utils/contacts";
import {
  asExpirationStatus,
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
  serviceAddress?: unknown;
  billingAddress?: unknown;
  primaryContactName?: unknown;
  primaryContactTitle?: unknown;
  counterId?: unknown;
  notes?: unknown;
  customerEmail?: unknown;
  customerPhone?: unknown;
  contacts?: unknown;
  contractStartDate?: unknown;
  contractExpirationDate?: unknown;
  contractCheckupIntervalMonths?: unknown;
  contractExpirationStatus?: unknown;
  overhaulExpirationDate?: unknown;
  overhaulExpirationStatus?: unknown;
  gasSensorExpirationDate?: unknown;
  gasSensorExpirationStatus?: unknown;
  gasSensorPeriodMonths?: unknown;
  overhaulBaseDate?: unknown;
  overhaulDueDate?: unknown;
  gasSensorBaseDate?: unknown;
  gasSensorDueDate?: unknown;
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
    overhaulExpirationDate:
      typeof payload.overhaulExpirationDate === "undefined"
        ? existingClient.overhaulExpirationDate
        : payload.overhaulExpirationDate,
    overhaulExpirationStatus:
      typeof payload.overhaulExpirationStatus === "undefined"
        ? existingClient.overhaulExpirationStatus
        : payload.overhaulExpirationStatus,
    gasSensorExpirationDate:
      typeof payload.gasSensorExpirationDate === "undefined"
        ? existingClient.gasSensorExpirationDate
        : payload.gasSensorExpirationDate,
    gasSensorExpirationStatus:
      typeof payload.gasSensorExpirationStatus === "undefined"
        ? existingClient.gasSensorExpirationStatus
        : payload.gasSensorExpirationStatus,
    gasSensorPeriodMonths:
      typeof payload.gasSensorPeriodMonths === "undefined"
        ? existingClient.gasSensorPeriodMonths
        : payload.gasSensorPeriodMonths,
    legacyOverhaulBaseDate:
      typeof payload.overhaulBaseDate === "undefined"
        ? null
        : payload.overhaulBaseDate,
    legacyOverhaulDueDate:
      typeof payload.overhaulDueDate === "undefined"
        ? null
        : payload.overhaulDueDate,
    legacyGasSensorBaseDate:
      typeof payload.gasSensorBaseDate === "undefined"
        ? null
        : payload.gasSensorBaseDate,
    legacyGasSensorDueDate:
      typeof payload.gasSensorDueDate === "undefined"
        ? null
        : payload.gasSensorDueDate,
  });
  const nextContacts =
    typeof payload.contacts === "undefined"
      ? Array.isArray(existingClient.contacts)
        ? existingClient.contacts
        : []
      : parseClientContacts(payload.contacts);
  const resolvedCustomerContacts = resolveCustomerContacts({
    customerEmail:
      typeof payload.customerEmail === "undefined"
        ? existingClient.customerEmail
        : payload.customerEmail,
    customerPhone:
      typeof payload.customerPhone === "undefined"
        ? existingClient.customerPhone
        : payload.customerPhone,
    legacyContacts: nextContacts,
  });

  if (!resolvedCustomerContacts.customerEmail && !resolvedCustomerContacts.customerPhone) {
    throw createError({
      statusCode: 400,
      statusMessage: "At least one customer contact (email or phone) is required",
    });
  }

  const nextClient: MaintenanceClientDocument = {
    ...existingClient,
    name:
      typeof payload.name === "undefined"
        ? existingClient.name
        : asRequiredText(payload.name, 180, "name"),
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
    customerEmail: resolvedCustomerContacts.customerEmail,
    customerPhone: resolvedCustomerContacts.customerPhone,
    contacts: nextContacts,
    ...contractFields,
    contractExpirationStatus:
      contractFields.contractExpirationDate === null
        ? null
        : typeof payload.contractExpirationStatus === "undefined"
          ? existingClient.contractExpirationStatus
          : asExpirationStatus(payload.contractExpirationStatus),
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
      name: existingClient.name,
      contractExpirationStatus: existingClient.contractExpirationStatus,
      overhaulExpirationStatus: existingClient.overhaulExpirationStatus,
      gasSensorExpirationStatus: existingClient.gasSensorExpirationStatus,
    },
    nextState: {
      name: nextClient.name,
      contractExpirationDate: nextClient.contractExpirationDate,
      contractExpirationStatus: nextClient.contractExpirationStatus,
      overhaulExpirationDate: nextClient.overhaulExpirationDate,
      overhaulExpirationStatus: nextClient.overhaulExpirationStatus,
      gasSensorExpirationDate: nextClient.gasSensorExpirationDate,
      gasSensorExpirationStatus: nextClient.gasSensorExpirationStatus,
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
