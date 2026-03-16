import { getDocument, getView, putDocument } from "#database/utils/couchdb";
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
  MaintenanceContractDocument,
  MaintenanceNotificationDocument,
} from "./types";
import { writeMaintenanceAuditEntry } from "./audit";

interface RunContractExpiryCheckInput {
  actor: string;
  dryRun?: boolean;
}

export interface RunContractExpiryCheckSummary {
  runAt: string;
  targetDate: string;
  contractsMatched: number;
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
  const config = await readMaintenanceEnvConfig();
  const targetDate = toIsoDateOnly(addDaysUtc(now, config.reminderDaysBeforeExpiry));
  const databaseName = await ensureMaintenanceDatabase();

  const contractView = await getView(
    databaseName,
    "maintenance",
    "contracts_by_expiration_date",
    {
      startkey: [targetDate],
      endkey: [targetDate, {}],
      include_docs: true,
      descending: false,
    },
  );

  const contracts = (contractView?.rows ?? [])
    .map((row) => row.doc as MaintenanceContractDocument | undefined)
    .filter(
      (doc): doc is MaintenanceContractDocument =>
        Boolean(doc && doc.type === "maintenance_contract" && doc.clientId),
    )
    .filter((contract) => contract.status !== "expired");

  let notificationsSent = 0;
  let notificationsFailed = 0;
  let notificationsSkipped = 0;
  let notificationsDryRunQueued = 0;

  for (const contract of contracts) {
    const client = await getDocument<MaintenanceClientDocument>(
      databaseName,
      contract.clientId,
    );
    if (!client || client.type !== "maintenance_client") {
      notificationsSkipped += 1;
      continue;
    }

    if (!input.dryRun && contract.status === "active") {
      const updatedContract: MaintenanceContractDocument = {
        ...contract,
        status: "expiring_soon",
        updatedAt: nowIso,
      };
      await putDocument(databaseName, updatedContract);
      await writeMaintenanceAuditEntry({
        databaseName,
        entityType: "contract",
        entityId: contract._id,
        action: "cron_mark_expiring_soon",
        actor: input.actor,
        previousState: { status: contract.status },
        nextState: { status: updatedContract.status },
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
        targetDate,
        contract._id,
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
        relatedId: contract._id,
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
          contractId: contract._id,
          expirationDate: contract.expirationDate,
        },
        sentAt: null,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      const reminderText = buildContractReminderText(client.name, contract.expirationDate);
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
    targetDate,
    contractsMatched: contracts.length,
    notificationsSent,
    notificationsFailed,
    notificationsSkipped,
    notificationsDryRunQueued,
  };
};
