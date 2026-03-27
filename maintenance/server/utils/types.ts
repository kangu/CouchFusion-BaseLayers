import type { CouchDBDocument } from "#database/utils/couchdb";

export type MaintenanceContactChannel = "email" | "sms";
export type MaintenanceContactPurpose =
  | "company"
  | "customer"
  | "billing"
  | "technical";

export type MaintenanceExpirationStatus =
  | "active"
  | "expiring_soon"
  | "expired"
  | "renewed";
export type MaintenanceJobStatus =
  | "pending"
  | "scheduled"
  | "done"
  | "rejected"
  | "canceled_by_customer";
export type MaintenanceJobType =
  | "check_2y"
  | "overhaul_10y"
  | "gas_sensor_change";
export type MaintenanceNotificationStatus = "queued" | "sent" | "failed";
export type MaintenanceNotificationCategory =
  | "check_2y"
  | "overhaul_10y"
  | "gas_sensor_change";

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
  serviceAddress: MaintenanceAddress;
  billingAddress: MaintenanceAddress | null;
  primaryContactName: string | null;
  primaryContactTitle: string | null;
  counterId: string | null;
  notes: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  contacts?: MaintenanceContactMethod[];
  contractStartDate: string | null;
  contractExpirationDate: string | null;
  contractExpirationStatus: MaintenanceExpirationStatus | null;
  contractCheckupIntervalMonths: number | null;
  overhaulExpirationDate: string | null;
  overhaulExpirationStatus: MaintenanceExpirationStatus | null;
  gasSensorExpirationDate: string | null;
  gasSensorPeriodMonths: number | null;
  gasSensorExpirationStatus: MaintenanceExpirationStatus | null;
  createdAt: string;
  updatedAt: string;
}

export interface MaintenanceJobDocument extends CouchDBDocument {
  type: "maintenance_job";
  clientId: string;
  jobType: MaintenanceJobType;
  scheduledFor: string;
  appointmentAt: string | null;
  reservationNotes: string | null;
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
  category: MaintenanceNotificationCategory;
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
    [key: string]: unknown;
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
