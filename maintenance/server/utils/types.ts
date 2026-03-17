import type { CouchDBDocument } from "#database/utils/couchdb";

export type MaintenanceContactChannel = "email" | "sms";
export type MaintenanceContactPurpose =
  | "company"
  | "customer"
  | "billing"
  | "technical";

export type MaintenanceClientStatus =
  | "active"
  | "expiring_soon"
  | "expired"
  | "renewed"
  | "discontinued";
export type MaintenanceJobStatus = "pending" | "done" | "rejected";
export type MaintenanceNotificationStatus = "queued" | "sent" | "failed";

export interface MaintenanceAddress {
  line1: string;
  line2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
}

export interface MaintenanceContactMethod {
  id: string;
  channel: MaintenanceContactChannel;
  value: string;
  purpose: MaintenanceContactPurpose;
  active: boolean;
  label?: string | null;
}

export interface MaintenanceClientDocument extends CouchDBDocument {
  type: "maintenance_client";
  name: string;
  status: MaintenanceClientStatus;
  serviceAddress: MaintenanceAddress;
  billingAddress: MaintenanceAddress | null;
  primaryContactName: string | null;
  primaryContactTitle: string | null;
  counterId: string | null;
  notes: string | null;
  contacts: MaintenanceContactMethod[];
  contractStartDate: string | null;
  contractExpirationDate: string | null;
  contractCheckupIntervalMonths: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface MaintenanceJobDocument extends CouchDBDocument {
  type: "maintenance_job";
  clientId: string;
  scheduledFor: string;
  status: MaintenanceJobStatus;
  assignedTo: string | null;
  completionNotes: string | null;
  rejectionReason: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MaintenanceNotificationDocument extends CouchDBDocument {
  type: "maintenance_notification";
  category: "contract_expiry";
  relatedId: string;
  channel: MaintenanceContactChannel;
  recipient: string;
  recipientRole: "company" | "customer";
  status: MaintenanceNotificationStatus;
  template: string;
  idempotencyKey: string;
  attempts: number;
  errorMessage: string | null;
  payload: {
    clientName: string;
    clientId: string;
    expirationDate: string;
  };
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MaintenanceAuditDocument extends CouchDBDocument {
  type: "maintenance_audit";
  entityType: "client" | "job" | "notification";
  entityId: string;
  action: string;
  actor: string;
  previousState: Record<string, unknown> | null;
  nextState: Record<string, unknown> | null;
  createdAt: string;
}
