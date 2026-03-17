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

const buildContractReminderText = (
  clientName: string,
  expirationDate: string,
): string => {
  return [
    `Maintenance reminder for ${clientName}.`,
    `Contract expiration date: ${expirationDate}.`,
    "Please contact the maintenance team to schedule the checkup.",
  ].join(" ");
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

  const clientView = await getView(
    databaseName,
    "maintenance",
    "clients_by_contract_expiration_date",
    {
      startkey: ["0000-01-01"],
      endkey: [targetDate, {}],
      include_docs: true,
      descending: false,
    },
  );

  const clientsInScope = (clientView?.rows ?? [])
    .map((row) => row.doc as MaintenanceClientDocument | undefined)
    .filter(
      (doc): doc is MaintenanceClientDocument =>
        Boolean(doc && doc.type === "maintenance_client" && doc.contractExpirationDate),
    )
    .filter((client) => client.status !== "discontinued");

  const upcomingClients = clientsInScope.filter(
    (client) => (client.contractExpirationDate as string) >= todayDate,
  );
  const pastExpiredClients = clientsInScope.filter(
    (client) => (client.contractExpirationDate as string) < todayDate,
  );

  if (pastExpiredClients.length > 0 && typeof input.includePastExpired === "undefined") {
    return {
      runAt: nowIso,
      windowStartDate: todayDate,
      targetDate,
      clientsMatched: upcomingClients.length,
      pastExpiredClientsFound: pastExpiredClients.length,
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

  const clientsForJobCreation = input.includePastExpired
    ? [...upcomingClients, ...pastExpiredClients]
    : upcomingClients;

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

  const pendingClientIds = new Set(
    (pendingJobsView?.rows ?? [])
      .map((row) => row.doc as MaintenanceJobDocument | undefined)
      .filter((doc): doc is MaintenanceJobDocument => Boolean(doc && doc.type === "maintenance_job"))
      .map((job) => job.clientId),
  );

  let jobsCreated = 0;
  let jobsSkippedExistingPending = 0;
  let jobsDryRunQueued = 0;

  for (const client of clientsForJobCreation) {
    if (pendingClientIds.has(client._id)) {
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
      clientId: client._id,
      scheduledFor: client.contractExpirationDate as string,
      status: "pending",
      assignedTo: null,
      completionNotes: null,
      rejectionReason: null,
      completedAt: null,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    await putDocument(databaseName, job);
    pendingClientIds.add(client._id);
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
        scheduledFor: job.scheduledFor,
      },
    });
  }

  let notificationsSent = 0;
  let notificationsFailed = 0;
  let notificationsSkipped = 0;
  let notificationsDryRunQueued = 0;

  for (const client of upcomingClients) {
    if (!input.dryRun && client.status === "active") {
      const updatedClient: MaintenanceClientDocument = {
        ...client,
        status: "expiring_soon",
        updatedAt: nowIso,
      };
      await putDocument(databaseName, updatedClient);
      await writeMaintenanceAuditEntry({
        databaseName,
        entityType: "client",
        entityId: client._id,
        action: "cron_mark_expiring_soon",
        actor: input.actor,
        previousState: { status: client.status },
        nextState: { status: updatedClient.status },
      });
    }

    const recipients = buildNotificationRecipients(
      client,
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
        "contract_expiry",
        client.contractExpirationDate,
        client._id,
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
        category: "contract_expiry",
        relatedId: client._id,
        channel: destination.channel,
        recipient: destination.recipient,
        recipientRole: destination.recipientRole,
        status: "queued",
        template: "contract_expiry_default",
        idempotencyKey,
        attempts: 0,
        errorMessage: null,
        payload: {
          clientName: client.name,
          clientId: client._id,
          expirationDate: client.contractExpirationDate as string,
        },
        sentAt: null,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      const reminderText = buildContractReminderText(
        client.name,
        client.contractExpirationDate as string,
      );
      const sendResult =
        destination.channel === "email"
          ? await sendEmailNotification({
              to: destination.recipient,
              subject: `Maintenance Reminder - ${client.name}`,
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
    clientsMatched: upcomingClients.length,
    pastExpiredClientsFound: pastExpiredClients.length,
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
