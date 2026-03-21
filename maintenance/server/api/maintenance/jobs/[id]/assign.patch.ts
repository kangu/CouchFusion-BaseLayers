import {
  createError,
  defineEventHandler,
  getRouterParam,
  readBody,
} from "h3";
import { getDocument, putDocument } from "#database/utils/couchdb";
import { asOptionalText } from "../../../../utils/parsers";
import { assertMaintenanceRole } from "../../../../utils/assert-maintenance-role";
import { ensureMaintenanceDatabase } from "../../../../utils/maintenance-db";
import type { MaintenanceJobDocument } from "../../../../utils/types";
import { writeMaintenanceAuditEntry } from "../../../../utils/audit";

interface JobAssignPayload {
  assignedTo: unknown;
}

export default defineEventHandler(async (event) => {
  const actor = await assertMaintenanceRole(event, ["admin"]);
  const jobId = getRouterParam(event, "id", { decode: true });
  if (!jobId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Job id is required",
    });
  }

  const payload = await readBody<JobAssignPayload>(event);
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

  const newAssignedTo = asOptionalText(payload.assignedTo, 180, "assignedTo");
  const now = new Date().toISOString();

  const updatedJob: MaintenanceJobDocument = {
    ...job,
    jobType: job.jobType || "check_2y",
    assignedTo: newAssignedTo,
    updatedAt: now,
  };

  const result = await putDocument(databaseName, updatedJob);

  await writeMaintenanceAuditEntry({
    databaseName,
    entityType: "job",
    entityId: job._id,
    action: "job_assign_employee",
    actor: actor.username,
    previousState: {
      assignedTo: job.assignedTo,
    },
    nextState: {
      assignedTo: newAssignedTo,
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
