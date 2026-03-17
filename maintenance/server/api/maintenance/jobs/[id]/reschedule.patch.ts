import {
  createError,
  defineEventHandler,
  getRouterParam,
  readBody,
} from "h3";
import { getDocument, putDocument } from "#database/utils/couchdb";
import { ensureIsoDateOnly } from "../../../../utils/dates";
import { assertMaintenanceRole } from "../../../../utils/assert-maintenance-role";
import { ensureMaintenanceDatabase } from "../../../../utils/maintenance-db";
import type { MaintenanceJobDocument } from "../../../../utils/types";
import { writeMaintenanceAuditEntry } from "../../../../utils/audit";

interface JobReschedulePayload {
  scheduledFor: unknown;
}

export default defineEventHandler(async (event) => {
  const actor = await assertMaintenanceRole(event, ["admin", "employee"]);
  const jobId = getRouterParam(event, "id", { decode: true });
  if (!jobId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Job id is required",
    });
  }

  const payload = await readBody<JobReschedulePayload>(event);
  if (!payload || typeof payload !== "object") {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid payload",
    });
  }

  const databaseName = await ensureMaintenanceDatabase();
  const job = await getDocument<MaintenanceJobDocument>(databaseName, jobId);
  if (!job || job.type !== "maintenance_job") {
    throw createError({
      statusCode: 404,
      statusMessage: "Job not found",
    });
  }

  if (job.status !== "pending") {
    throw createError({
      statusCode: 409,
      statusMessage: "Only pending jobs can be rescheduled",
    });
  }

  const newScheduledFor = ensureIsoDateOnly(payload.scheduledFor, "scheduledFor");
  const now = new Date().toISOString();

  const updatedJob: MaintenanceJobDocument = {
    ...job,
    scheduledFor: newScheduledFor,
    updatedAt: now,
  };

  const result = await putDocument(databaseName, updatedJob);

  await writeMaintenanceAuditEntry({
    databaseName,
    entityType: "job",
    entityId: job._id,
    action: "job_reschedule",
    actor: actor.username,
    previousState: {
      scheduledFor: job.scheduledFor,
    },
    nextState: {
      scheduledFor: newScheduledFor,
    },
  });

  return {
    success: true,
    id: result.id,
    rev: result.rev,
    job: {
      ...updatedJob,
      _rev: result.rev,
    },
  };
});