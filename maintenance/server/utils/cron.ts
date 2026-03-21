import { getView, putDocument } from "#database/utils/couchdb";
import { buildNotificationRecipients } from "./contacts";
import { addDaysUtc, toIsoDateOnly } from "./dates";
import { readMaintenanceEnvConfig } from "./config";
import { ensureMaintenanceDatabase } from "./maintenance-db";
import {
  sendEmailNotification,
  sendSmsNotification,
} from "./notification-adapters";
import type {
  MaintenanceClientDocument,
  MaintenanceJobDocument,
  MaintenanceJobType,
  MaintenanceNotificationCategory,
  MaintenanceNotificationDocument,
} from "./types";
import { writeMaintenanceAuditEntry } from "./audit";

interface RunContractExpiryCheckInput {
  actor: string;
  dryRun?: boolean;
  includePastExpired?: boolean;
}

export interface RunContractExpiryCheckSummary {
  runAt: string;
  windowStartDate: string;
  targetDate: string;
  clientsMatched: number;
  pastExpiredClientsFound: number;
  requiresPastExpiredDecision: boolean;
  jobsCreated: number;
  jobsSkippedExistingPending: number;
  jobsDryRunQueued: number;
  notificationsSent: number;
  notificationsFailed: number;
  notificationsSkipped: number;
  notificationsDryRunQueued: number;
}

interface ScheduleEntry {
  client: MaintenanceClientDocument;
  dueDate: string;
  jobType: MaintenanceJobType;
  notificationCategory: MaintenanceNotificationCategory;
  label: string;
}

const buildNotificationDocId = (idempotencyKey: string): string => {
  const encoded = Buffer.from(idempotencyKey, "utf8").toString("base64url");
  return `maintenance_notification:${encoded}`;
};

const wasNotificationAlreadyProcessed = async (
  databaseName: string,
  idempotencyKey: string,
): Promise<boolean> => {
  const view = await getView(
    databaseName,
    "maintenance",
    "notifications_by_idempotency",
    {
      key: idempotencyKey,
      include_docs: false,
      limit: 1,
    },
  );

  return Array.isArray(view?.rows) && view.rows.length > 0;
};

const buildReminderText = (
  clientName: string,
  label: string,
  dueDate: string,
): string => {
  return [
    `Maintenance reminder for ${clientName}.`,
    `${label} due date: ${dueDate}.`,
    "Please contact the maintenance team to schedule the checkup.",
  ].join(" ");
};

const collectScheduleEntries = (
  clients: MaintenanceClientDocument[],
  targetDate: string,
): { upcomingEntries: ScheduleEntry[]; pastEntries: ScheduleEntry[] } => {
  const entries: ScheduleEntry[] = [];

  for (const client of clients) {
    if (client.contractExpirationDate) {
      entries.push({
        client,
        dueDate: client.contractExpirationDate,
        jobType: "check_2y",
        notificationCategory: "check_2y",
        label: "2-year check",
      });
    }

    if (client.overhaulDueDate) {
      entries.push({
        client,
        dueDate: client.overhaulDueDate,
        jobType: "overhaul_10y",
        notificationCategory: "overhaul_10y",
        label: "10-year overhaul",
      });
    }

    if (client.gasSensorDueDate) {
      entries.push({
        client,
        dueDate: client.gasSensorDueDate,
        jobType: "gas_sensor_change",
        notificationCategory: "gas_sensor_change",
        label: "Gas sensor change",
      });
    }
  }

  const inWindow = entries.filter((entry) => entry.dueDate <= targetDate);
  return {
    upcomingEntries: inWindow,
    pastEntries: inWindow,
  };
};

export const runContractExpiryCheck = async (
  input: RunContractExpiryCheckInput,
): Promise<RunContractExpiryCheckSummary> => {
  const now = new Date();
  const nowIso = now.toISOString();
  const todayDate = toIsoDateOnly(now);
  const config = await readMaintenanceEnvConfig();
  const targetDate = toIsoDateOnly(addDaysUtc(now, config.reminderDaysBeforeExpiry));
  const databaseName = await ensureMaintenanceDatabase();

  const clientView = await getView(databaseName, "maintenance", "clients_by_name", {
    include_docs: true,
    descending: false,
  });

  const clients = (clientView?.rows ?? [])
    .map((row) => row.doc as MaintenanceClientDocument | undefined)
    .filter(
      (doc): doc is MaintenanceClientDocument =>
        Boolean(doc && doc.type === "maintenance_client"),
    )
    .filter((client) => client.status !== "discontinued");

  const scheduleEntries = collectScheduleEntries(clients, targetDate);
  const upcomingEntries = scheduleEntries.upcomingEntries.filter(
    (entry) => entry.dueDate >= todayDate,
  );
  const pastEntries = scheduleEntries.pastEntries.filter(
    (entry) => entry.dueDate < todayDate,
  );

  const upcomingClientCount = new Set(upcomingEntries.map((entry) => entry.client._id)).size;
  const pastClientCount = new Set(pastEntries.map((entry) => entry.client._id)).size;

  if (pastEntries.length > 0 && typeof input.includePastExpired === "undefined") {
    return {
      runAt: nowIso,
      windowStartDate: todayDate,
      targetDate,
      clientsMatched: upcomingClientCount,
      pastExpiredClientsFound: pastClientCount,
      requiresPastExpiredDecision: true,
      jobsCreated: 0,
      jobsSkippedExistingPending: 0,
      jobsDryRunQueued: 0,
      notificationsSent: 0,
      notificationsFailed: 0,
      notificationsSkipped: 0,
      notificationsDryRunQueued: 0,
    };
  }

  const entriesForJobCreation = input.includePastExpired
    ? [...upcomingEntries, ...pastEntries]
    : upcomingEntries;

  const pendingJobsView = await getView(
    databaseName,
    "maintenance",
    "jobs_by_status_scheduled",
    {
      startkey: ["pending"],
      endkey: ["pending", {}],
      include_docs: true,
      descending: false,
    },
  );

  const pendingJobKeys = new Set(
    (pendingJobsView?.rows ?? [])
      .map((row) => row.doc as MaintenanceJobDocument | undefined)
      .filter((doc): doc is MaintenanceJobDocument => Boolean(doc && doc.type === "maintenance_job"))
      .map((job) => `${job.clientId}:${job.jobType || "check_2y"}`),
  );

  let jobsCreated = 0;
  let jobsSkippedExistingPending = 0;
  let jobsDryRunQueued = 0;

  for (const entry of entriesForJobCreation) {
    const pendingKey = `${entry.client._id}:${entry.jobType}`;
    if (pendingJobKeys.has(pendingKey)) {
      jobsSkippedExistingPending += 1;
      continue;
    }

    if (input.dryRun) {
      jobsDryRunQueued += 1;
      continue;
    }

    const job: MaintenanceJobDocument = {
      _id: `maintenance_job:${crypto.randomUUID()}`,
      type: "maintenance_job",
      clientId: entry.client._id,
      jobType: entry.jobType,
      scheduledFor: entry.dueDate,
      appointmentAt: null,
      reservationNotes: null,
      status: "pending",
      assignedTo: null,
      completionNotes: null,
      rejectionReason: null,
      completedAt: null,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    await putDocument(databaseName, job);
    pendingJobKeys.add(pendingKey);
    jobsCreated += 1;

    await writeMaintenanceAuditEntry({
      databaseName,
      entityType: "job",
      entityId: job._id,
      action: "cron_create_job_from_expiry_window",
      actor: input.actor,
      previousState: null,
      nextState: {
        status: job.status,
        clientId: job.clientId,
        jobType: job.jobType,
        scheduledFor: job.scheduledFor,
      },
    });
  }

  let notificationsSent = 0;
  let notificationsFailed = 0;
  let notificationsSkipped = 0;
  let notificationsDryRunQueued = 0;

  for (const entry of upcomingEntries) {
    if (!input.dryRun && entry.jobType === "check_2y" && entry.client.status === "active") {
      const updatedClient: MaintenanceClientDocument = {
        ...entry.client,
        status: "expiring_soon",
        updatedAt: nowIso,
      };
      await putDocument(databaseName, updatedClient);
      await writeMaintenanceAuditEntry({
        databaseName,
        entityType: "client",
        entityId: entry.client._id,
        action: "cron_mark_expiring_soon",
        actor: input.actor,
        previousState: { status: entry.client.status },
        nextState: { status: updatedClient.status },
      });
    }

    const recipients = buildNotificationRecipients(
      entry.client,
      config.companyNotificationEmails,
    );

    const channels: Array<{
      channel: "email" | "sms";
      recipient: string;
      recipientRole: "company" | "customer";
    }> = [
      ...recipients.companyEmails.map((recipient) => ({
        channel: "email" as const,
        recipient,
        recipientRole: "company" as const,
      })),
      ...recipients.customerEmails.map((recipient) => ({
        channel: "email" as const,
        recipient,
        recipientRole: "customer" as const,
      })),
      ...recipients.companySms.map((recipient) => ({
        channel: "sms" as const,
        recipient,
        recipientRole: "company" as const,
      })),
      ...recipients.customerSms.map((recipient) => ({
        channel: "sms" as const,
        recipient,
        recipientRole: "customer" as const,
      })),
    ];

    for (const destination of channels) {
      const idempotencyKey = [
        entry.notificationCategory,
        entry.dueDate,
        entry.client._id,
        destination.channel,
        destination.recipient,
      ].join(":");

      if (await wasNotificationAlreadyProcessed(databaseName, idempotencyKey)) {
        notificationsSkipped += 1;
        continue;
      }

      if (input.dryRun) {
        notificationsDryRunQueued += 1;
        continue;
      }

      const notificationDocId = buildNotificationDocId(idempotencyKey);
      const notificationDocument: MaintenanceNotificationDocument = {
        _id: notificationDocId,
        type: "maintenance_notification",
        category: entry.notificationCategory,
        relatedId: entry.client._id,
        channel: destination.channel,
        recipient: destination.recipient,
        recipientRole: destination.recipientRole,
        status: "queued",
        template: `${entry.notificationCategory}_default`,
        idempotencyKey,
        attempts: 0,
        errorMessage: null,
        payload: {
          clientName: entry.client.name,
          clientId: entry.client._id,
          expirationDate: entry.dueDate,
        },
        sentAt: null,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      const reminderText = buildReminderText(
        entry.client.name,
        entry.label,
        entry.dueDate,
      );
      const sendResult =
        destination.channel === "email"
          ? await sendEmailNotification({
              to: destination.recipient,
              subject: `Maintenance Reminder - ${entry.client.name}`,
              text: reminderText,
            })
          : await sendSmsNotification({
              to: destination.recipient,
              sender: config.smsSender,
              text: reminderText,
            });

      const finalizedNotification: MaintenanceNotificationDocument = {
        ...notificationDocument,
        attempts: 1,
        status: sendResult.ok ? "sent" : "failed",
        errorMessage: sendResult.errorMessage,
        sentAt: sendResult.ok ? nowIso : null,
        updatedAt: nowIso,
      };

      await putDocument(databaseName, finalizedNotification);

      if (sendResult.ok) {
        notificationsSent += 1;
      } else {
        notificationsFailed += 1;
      }
    }
  }

  return {
    runAt: nowIso,
    windowStartDate: todayDate,
    targetDate,
    clientsMatched: upcomingClientCount,
    pastExpiredClientsFound: pastClientCount,
    requiresPastExpiredDecision: false,
    jobsCreated,
    jobsSkippedExistingPending,
    jobsDryRunQueued,
    notificationsSent,
    notificationsFailed,
    notificationsSkipped,
    notificationsDryRunQueued,
  };
};
