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
  const failedCustomerNotificationsView = await getView(
    databaseName,
    "maintenance",
    "notifications_failed_customer_by_client",
    {
      include_docs: false,
    },
  );
  const clientsWithFailedCustomerDeliveries = new Set(
    (failedCustomerNotificationsView?.rows ?? [])
      .map((row) => String(row?.key ?? "").trim())
      .filter(Boolean),
  );

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
      return (
        client.contractExpirationStatus === status ||
        client.overhaulExpirationStatus === status ||
        client.gasSensorExpirationStatus === status
      );
    })
    .filter((client) => {
      if (!search.length) {
        return true;
      }

      const haystack = [
        client.name,
        client.primaryContactName,
        client.counterId,
        client.serviceAddress?.line1,
        client.serviceAddress?.city,
        client.serviceAddress?.country,
      ]
        .map((value) => String(value ?? "").toLowerCase())
        .join(" ");

      return haystack.includes(search);
    })
    .map((client) => ({
      ...client,
      customerEmail:
        client.customerEmail ??
        (client.contacts ?? []).find(
          (contact) =>
            contact.active !== false &&
            contact.channel === "email" &&
            contact.purpose === "customer",
        )?.value ??
        null,
      customerPhone:
        client.customerPhone ??
        (client.contacts ?? []).find(
          (contact) =>
            contact.active !== false &&
            contact.channel === "sms" &&
            contact.purpose === "customer",
        )?.value ??
        null,
      hasCustomerDeliveryFailure: clientsWithFailedCustomerDeliveries.has(client._id),
      contractExpirationStatus:
        client.contractExpirationDate === null
          ? null
          : client.contractExpirationStatus ?? "active",
      overhaulExpirationDate:
        client.overhaulExpirationDate ??
        (client as unknown as Record<string, unknown>).overhaulDueDate ??
        (client as unknown as Record<string, unknown>).overhaulBaseDate ??
        null,
      overhaulExpirationStatus:
        (client.overhaulExpirationDate ??
          (client as unknown as Record<string, unknown>).overhaulDueDate ??
          (client as unknown as Record<string, unknown>).overhaulBaseDate ??
          null) === null
          ? null
          : client.overhaulExpirationStatus ?? "active",
      gasSensorExpirationDate:
        client.gasSensorExpirationDate ??
        (client as unknown as Record<string, unknown>).gasSensorDueDate ??
        (client as unknown as Record<string, unknown>).gasSensorBaseDate ??
        null,
      gasSensorPeriodMonths: client.gasSensorPeriodMonths ?? null,
      gasSensorExpirationStatus:
        (client.gasSensorExpirationDate ??
          (client as unknown as Record<string, unknown>).gasSensorDueDate ??
          (client as unknown as Record<string, unknown>).gasSensorBaseDate ??
          null) === null
          ? null
          : client.gasSensorExpirationStatus ?? "active",
    }));

  return {
    clients,
    total: clients.length,
  };
});
