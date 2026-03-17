import {
  createError,
  defineEventHandler,
  getRouterParam,
  readBody,
} from "h3";
import { getDocument, putDocument } from "#database/utils/couchdb";
import { readMaintenanceEnvConfig } from "../../../../utils/config";
import { addMonthsToIsoDate, toIsoDateOnly } from "../../../../utils/dates";
import { asJobStatusTransitionTarget, asOptionalText } from "../../../../utils/parsers";
import { assertMaintenanceRole } from "../../../../utils/assert-maintenance-role";
import { ensureMaintenanceDatabase } from "../../../../utils/maintenance-db";
import type {
  MaintenanceClientDocument,
  MaintenanceJobDocument,
} from "../../../../utils/types";
import { writeMaintenanceAuditEntry } from "../../../../utils/audit";

interface JobStatusPayload {
  status?: unknown;
  rejectionReason?: unknown;
  completionNotes?: unknown;
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

  const payload = await readBody<JobStatusPayload>(event);
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
      statusMessage: "Only pending jobs can be transitioned",
    });
  }

  const targetStatus = asJobStatusTransitionTarget(payload.status);
  const now = new Date().toISOString();
  const completionDate = toIsoDateOnly(new Date(now));
  const updatedJob: MaintenanceJobDocument = {
    ...job,
    status: targetStatus,
    rejectionReason:
      targetStatus === "rejected"
        ? asOptionalText(payload.rejectionReason, 1000, "rejectionReason")
        : null,
    completionNotes: asOptionalText(payload.completionNotes, 5000, "completionNotes"),
    completedAt: now,
    updatedAt: now,
  };

  const result = await putDocument(databaseName, updatedJob);

  await writeMaintenanceAuditEntry({
    databaseName,
    entityType: "job",
    entityId: job._id,
    action: "job_status_transition",
    actor: actor.username,
    previousState: {
      status: job.status,
    },
    nextState: {
      status: updatedJob.status,
    },
  });

  let followUpJob: MaintenanceJobDocument | null = null;

  if (targetStatus === "done") {
    const client = await getDocument<MaintenanceClientDocument>(
      databaseName,
      updatedJob.clientId,
    );

    const envConfig = await readMaintenanceEnvConfig();
    const monthsInterval =
      client?.contractCheckupIntervalMonths && client.contractCheckupIntervalMonths > 0
        ? client.contractCheckupIntervalMonths
        : envConfig.defaultCheckupMonths;

    followUpJob = {
      _id: `maintenance_job:${crypto.randomUUID()}`,
      type: "maintenance_job",
      clientId: updatedJob.clientId,
      scheduledFor: addMonthsToIsoDate(completionDate, monthsInterval),
      status: "pending",
      assignedTo: null,
      completionNotes: null,
      rejectionReason: null,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    const followUpResult = await putDocument(databaseName, followUpJob);
    followUpJob = {
      ...followUpJob,
      _rev: followUpResult.rev,
    };

    await writeMaintenanceAuditEntry({
      databaseName,
      entityType: "job",
      entityId: followUpJob._id,
      action: "job_auto_schedule_from_done",
      actor: actor.username,
      previousState: null,
      nextState: {
        status: followUpJob.status,
        scheduledFor: followUpJob.scheduledFor,
      },
    });
  }

  return {
    success: true,
    id: result.id,
    rev: result.rev,
    job: {
      ...updatedJob,
      _rev: result.rev,
    },
    followUpJob,
  };
});
