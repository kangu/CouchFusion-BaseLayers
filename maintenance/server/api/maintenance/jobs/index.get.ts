import { defineEventHandler, getQuery } from "h3";
import { getDocument, getView } from "#database/utils/couchdb";
import { assertMaintenanceRole } from "../../../utils/assert-maintenance-role";
import { ensureMaintenanceDatabase } from "../../../utils/maintenance-db";
import type {
  MaintenanceClientDocument,
  MaintenanceJobDocument,
} from "../../../utils/types";

export default defineEventHandler(async (event) => {
  await assertMaintenanceRole(event, ["admin", "employee"]);
  const query = getQuery(event);
  const statusFilter = String(query.status ?? "pending").trim().toLowerCase();
  const statuses = statusFilter
    .split(",")
    .map((status) => status.trim())
    .filter(Boolean);

  const databaseName = await ensureMaintenanceDatabase();
  const view = await getView(databaseName, "maintenance", "jobs_by_status_scheduled", {
    include_docs: true,
    descending: false,
  });

  const jobs = (view?.rows ?? [])
    .map((row) => row.doc as MaintenanceJobDocument | undefined)
    .filter(
      (doc): doc is MaintenanceJobDocument => Boolean(doc && doc.type === "maintenance_job"),
    )
    .filter((job) => (statuses.length ? statuses.includes(job.status) : true));

  const jobsWithRelations = await Promise.all(
    jobs.map(async (job) => {
      const client = await getDocument<MaintenanceClientDocument>(
        databaseName,
        job.clientId,
      );

      const phoneContact = client?.contacts?.find(
        (c) => c.channel === "sms" && c.active,
      );

      return {
        ...job,
        jobType: job.jobType || "check_2y",
        clientName: client?.name ?? null,
        contractExpirationDate: client?.contractExpirationDate ?? null,
        clientCheckupIntervalMonths: client?.contractCheckupIntervalMonths ?? null,
        clientServiceAddress: client?.serviceAddress ?? null,
        clientPhone: phoneContact?.value ?? null,
      };
    }),
  );

  return {
    jobs: jobsWithRelations,
    total: jobsWithRelations.length,
  };
});
