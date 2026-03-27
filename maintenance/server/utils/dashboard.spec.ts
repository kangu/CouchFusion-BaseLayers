import { describe, expect, it } from "vitest";
import { buildMaintenanceDashboardSummary } from "./dashboard";
import type {
  MaintenanceClientDocument,
  MaintenanceJobDocument,
  MaintenanceNotificationDocument,
} from "./types";

const baseTimestamp = "2026-03-27T08:00:00.000Z";

const makeClient = (
  overrides: Partial<MaintenanceClientDocument>,
): MaintenanceClientDocument => ({
  _id: `maintenance_client:${Math.random().toString(36).slice(2)}`,
  _rev: "1-test",
  type: "maintenance_client",
  name: "Client",
  serviceAddress: { line1: "Street 1", city: "Bucharest", country: "RO" },
  billingAddress: null,
  primaryContactName: null,
  primaryContactTitle: null,
  counterId: null,
  notes: null,
  customerEmail: "customer@example.com",
  customerPhone: null,
  contractStartDate: "2026-01-01",
  contractExpirationDate: null,
  contractExpirationStatus: null,
  contractCheckupIntervalMonths: 24,
  overhaulExpirationDate: null,
  overhaulExpirationStatus: null,
  gasSensorExpirationDate: null,
  gasSensorPeriodMonths: null,
  gasSensorExpirationStatus: null,
  createdAt: baseTimestamp,
  updatedAt: baseTimestamp,
  ...overrides,
});

const makeJob = (
  overrides: Partial<MaintenanceJobDocument>,
): MaintenanceJobDocument => ({
  _id: `maintenance_job:${Math.random().toString(36).slice(2)}`,
  _rev: "1-test",
  type: "maintenance_job",
  clientId: "maintenance_client:default",
  jobType: "check_2y",
  scheduledFor: "2026-03-27",
  appointmentAt: null,
  reservationNotes: null,
  status: "pending",
  assignedTo: null,
  completionNotes: null,
  rejectionReason: null,
  completedAt: null,
  createdAt: baseTimestamp,
  updatedAt: baseTimestamp,
  ...overrides,
});

const makeNotification = (
  overrides: Partial<MaintenanceNotificationDocument>,
): MaintenanceNotificationDocument => ({
  _id: `maintenance_notification:${Math.random().toString(36).slice(2)}`,
  _rev: "1-test",
  type: "maintenance_notification",
  category: "check_2y",
  relatedId: "maintenance_client:default",
  channel: "email",
  recipient: "customer@example.com",
  recipientRole: "customer",
  status: "queued",
  template: "check_2y_default",
  idempotencyKey: `idem:${Math.random().toString(36).slice(2)}`,
  attempts: 0,
  errorMessage: null,
  payload: {
    clientName: "Client",
    clientId: "maintenance_client:default",
    expirationDate: "2026-03-27",
  },
  sentAt: null,
  createdAt: baseTimestamp,
  updatedAt: baseTimestamp,
  ...overrides,
});

describe("buildMaintenanceDashboardSummary", () => {
  it("returns alert counts, today totals, upcoming totals, and ordered previews", () => {
    const alpha = makeClient({
      _id: "maintenance_client:alpha",
      name: "Alpha Gas",
      contractExpirationDate: "2026-03-20",
      contractExpirationStatus: "expired",
    });
    const beta = makeClient({
      _id: "maintenance_client:beta",
      name: "Beta Heat",
      overhaulExpirationDate: "2026-03-18",
      overhaulExpirationStatus: "expired",
    });
    const gamma = makeClient({
      _id: "maintenance_client:gamma",
      name: "Gamma Flame",
      contractExpirationDate: "2026-03-29",
      contractExpirationStatus: "expiring_soon",
      gasSensorExpirationDate: "2026-03-30",
      gasSensorExpirationStatus: "expiring_soon",
      gasSensorPeriodMonths: 12,
    });

    const jobs = [
      makeJob({
        _id: "maintenance_job:pending-unassigned",
        clientId: alpha._id,
        status: "pending",
        scheduledFor: "2026-03-25",
      }),
      makeJob({
        _id: "maintenance_job:scheduled-alice",
        clientId: gamma._id,
        status: "scheduled",
        scheduledFor: "2026-03-27",
        appointmentAt: "2026-03-27T09:00",
        assignedTo: "alice",
      }),
      makeJob({
        _id: "maintenance_job:scheduled-bob",
        clientId: beta._id,
        jobType: "overhaul_10y",
        status: "scheduled",
        scheduledFor: "2026-03-27",
        appointmentAt: "2026-03-27T13:00",
        assignedTo: "bob",
      }),
    ];

    const notifications = [
      makeNotification({
        _id: "maintenance_notification:failed-new",
        relatedId: alpha._id,
        status: "failed",
        errorMessage: "SMTP timeout",
        createdAt: "2026-03-27T12:00:00.000Z",
      }),
      makeNotification({
        _id: "maintenance_notification:failed-old",
        relatedId: beta._id,
        status: "failed",
        errorMessage: "Gateway rejected",
        createdAt: "2026-03-26T12:00:00.000Z",
      }),
    ];

    const summary = buildMaintenanceDashboardSummary({
      clients: [alpha, beta, gamma],
      jobs,
      notifications,
      failedCustomerClientIds: new Set([alpha._id]),
      todayDate: "2026-03-27",
    });

    expect(summary.alerts).toEqual({
      expiredChecksTotal: 2,
      failedCustomerDeliveriesTotal: 1,
      failedNotificationsTotal: 2,
      unassignedPendingJobsTotal: 1,
    });
    expect(summary.today.scheduledTodayTotal).toBe(2);
    expect(summary.today.pendingJobsTotal).toBe(1);
    expect(summary.today.scheduledTodayByEmployee).toEqual([
      { employeeName: "alice", count: 1 },
      { employeeName: "bob", count: 1 },
    ]);
    expect(summary.upcoming).toEqual({
      check2yExpiringSoonTotal: 1,
      overhaul10yExpiringSoonTotal: 0,
      gasSensorExpiringSoonTotal: 1,
    });
    expect(summary.previews.expiredChecks).toEqual([
      {
        clientId: beta._id,
        clientName: "Beta Heat",
        checkType: "overhaul_10y",
        expirationDate: "2026-03-18",
      },
      {
        clientId: alpha._id,
        clientName: "Alpha Gas",
        checkType: "check_2y",
        expirationDate: "2026-03-20",
      },
    ]);
    expect(summary.previews.pendingJobs[0]).toMatchObject({
      jobId: "maintenance_job:pending-unassigned",
      clientName: "Alpha Gas",
      assignedTo: null,
    });
    expect(summary.previews.failedNotifications.map((item) => item.notificationId)).toEqual([
      "maintenance_notification:failed-new",
      "maintenance_notification:failed-old",
    ]);
  });
});
