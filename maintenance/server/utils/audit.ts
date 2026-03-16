import { putDocument } from "#database/utils/couchdb";
import type { MaintenanceAuditDocument } from "./types";

interface WriteAuditEntryInput {
  databaseName: string;
  entityType: MaintenanceAuditDocument["entityType"];
  entityId: string;
  action: string;
  actor: string;
  previousState?: Record<string, unknown> | null;
  nextState?: Record<string, unknown> | null;
}

export const writeMaintenanceAuditEntry = async (
  input: WriteAuditEntryInput,
): Promise<void> => {
  const now = new Date().toISOString();
  const auditDocument: MaintenanceAuditDocument = {
    _id: `maintenance_audit:${crypto.randomUUID()}`,
    type: "maintenance_audit",
    entityType: input.entityType,
    entityId: input.entityId,
    action: input.action,
    actor: input.actor,
    previousState: input.previousState ?? null,
    nextState: input.nextState ?? null,
    createdAt: now,
  };

  await putDocument(input.databaseName, auditDocument);
};
