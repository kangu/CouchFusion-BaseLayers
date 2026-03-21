import {
  createError,
  defineEventHandler,
  getRouterParam,
  readBody,
} from "h3";
import { getDocument, putDocument } from "#database/utils/couchdb";
import {
  addMonthsToIsoDate,
  ensureIsoDateOnly,
  ensureIsoDateOrDateTime,
  toIsoDateOnly,
} from "../../../../utils/dates";
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
  appointmentAt?: unknown;
  reservationNotes?: unknown;
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

  const targetStatus = asJobStatusTransitionTarget(payload.status);
  const isAdmin = actor.roles.includes("admin");
  const isEmployeeOnly = actor.roles.includes("employee") && !isAdmin;
  const runtimeConfig = useRuntimeConfig();
  const prefix = typeof runtimeConfig.dbLoginPrefix === "string" ? runtimeConfig.dbLoginPrefix : "";
  const actorNameForAssignments =
    prefix && actor.username.startsWith(prefix)
      ? actor.username.slice(prefix.length)
      : actor.username;

  if (
    (targetStatus === "scheduled" || targetStatus === "canceled_by_customer") &&
    !isAdmin
  ) {
    throw createError({
      statusCode: 403,
      statusMessage: "Only admin can schedule or cancel reservations",
    });
  }

  if (targetStatus === "scheduled") {
    if (job.status !== "pending") {
      throw createError({
        statusCode: 409,
        statusMessage: "Only pending jobs can be scheduled",
      });
    }
    if (!job.assignedTo) {
      throw createError({
        statusCode: 400,
        statusMessage: "A worker must be assigned before scheduling",
      });
    }
    if (
      typeof payload.appointmentAt === "undefined" ||
      payload.appointmentAt === null ||
      payload.appointmentAt === ""
    ) {
      throw createError({
        statusCode: 400,
        statusMessage: "appointmentAt is required when scheduling",
      });
    }
  } else if (targetStatus === "canceled_by_customer") {
    if (job.status !== "scheduled") {
      throw createError({
        statusCode: 409,
        statusMessage: "Only scheduled jobs can be canceled by customer",
      });
    }
  } else {
    if (job.status !== "pending" && job.status !== "scheduled") {
      throw createError({
        statusCode: 409,
        statusMessage: "Only pending or scheduled jobs can be transitioned",
      });
    }
    if (isEmployeeOnly && job.assignedTo !== actor.username) {
      const isAssignedToActor =
        job.assignedTo === actor.username || job.assignedTo === actorNameForAssignments;
      if (!isAssignedToActor) {
        throw createError({
          statusCode: 403,
          statusMessage: "Employees can only update their assigned jobs",
        });
      }
    }
  }

  const now = new Date().toISOString();
  const appointmentAt =
    targetStatus === "scheduled"
      ? ensureIsoDateOrDateTime(payload.appointmentAt, "appointmentAt")
      : job.appointmentAt ?? null;
  const reservationNotes =
    targetStatus === "scheduled"
      ? asOptionalText(payload.reservationNotes, 3000, "reservationNotes")
      : job.reservationNotes ?? null;
  const completedAt =
    targetStatus === "done" ||
    targetStatus === "rejected" ||
    targetStatus === "canceled_by_customer"
      ? now
      : null;

  const updatedJob: MaintenanceJobDocument = {
    ...job,
    jobType: job.jobType || "check_2y",
    status: targetStatus,
    appointmentAt,
    reservationNotes,
    rejectionReason:
      targetStatus === "rejected"
        ? asOptionalText(payload.rejectionReason, 1000, "rejectionReason")
        : null,
    completionNotes: asOptionalText(payload.completionNotes, 5000, "completionNotes"),
    completedAt,
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
      appointmentAt: updatedJob.appointmentAt,
    },
  });

  let followUpJob: MaintenanceJobDocument | null = null;

  if (targetStatus === "done") {
    const client = await getDocument<MaintenanceClientDocument>(
      databaseName,
      updatedJob.clientId,
    );

    if (client && client.type === "maintenance_client") {
      const completionDate = toIsoDateOnly(new Date(now));
      const effectiveJobType = updatedJob.jobType || "check_2y";
      const nextExpirationDate =
        effectiveJobType === "check_2y"
          ? typeof payload.nextExpirationDate === "undefined" ||
            payload.nextExpirationDate === null ||
            payload.nextExpirationDate === ""
            ? addMonthsToIsoDate(completionDate, 24)
            : ensureIsoDateOnly(payload.nextExpirationDate, "nextExpirationDate")
          : client.contractExpirationDate;
      const nextOverhaulDueDate =
        effectiveJobType === "overhaul_10y"
          ? addMonthsToIsoDate(completionDate, 120)
          : client.overhaulDueDate;
      const nextGasSensorDueDate =
        effectiveJobType === "gas_sensor_change" && client.gasSensorPeriodMonths
          ? addMonthsToIsoDate(completionDate, client.gasSensorPeriodMonths)
          : client.gasSensorDueDate;

      const nextClient: MaintenanceClientDocument = {
        ...client,
        contractExpirationDate: nextExpirationDate,
        overhaulBaseDate:
          effectiveJobType === "overhaul_10y" ? completionDate : client.overhaulBaseDate,
        overhaulDueDate: nextOverhaulDueDate,
        gasSensorBaseDate:
          effectiveJobType === "gas_sensor_change" ? completionDate : client.gasSensorBaseDate,
        gasSensorDueDate: nextGasSensorDueDate,
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
          overhaulDueDate: nextClient.overhaulDueDate,
          gasSensorDueDate: nextClient.gasSensorDueDate,
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
