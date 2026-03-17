import {
  createError,
  defineEventHandler,
  getRouterParam,
  readBody,
} from "h3";
import { getDocument, putDocument } from "#database/utils/couchdb";
import { ensureIsoDateOnly } from "../../../../utils/dates";
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
  nextExpirationDate?: unknown;
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
    const nextExpirationDate = ensureIsoDateOnly(
      payload.nextExpirationDate,
      "nextExpirationDate",
    );

    const client = await getDocument<MaintenanceClientDocument>(
      databaseName,
      updatedJob.clientId,
    );

    if (client && client.type === "maintenance_client") {
      const nextClient: MaintenanceClientDocument = {
        ...client,
        contractExpirationDate: nextExpirationDate,
        status: client.status === "discontinued" ? "discontinued" : "active",
        updatedAt: now,
      };
      await putDocument(databaseName, nextClient);

      await writeMaintenanceAuditEntry({
        databaseName,
        entityType: "client",
        entityId: client._id,
        action: "job_done_set_next_expiration",
        actor: actor.username,
        previousState: {
          status: client.status,
          contractExpirationDate: client.contractExpirationDate,
        },
        nextState: {
          status: nextClient.status,
          contractExpirationDate: nextClient.contractExpirationDate,
        },
      });
    }
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
