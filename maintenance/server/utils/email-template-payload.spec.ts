import { describe, expect, it } from "vitest";
import { buildMaintenanceEmailTemplatePayload } from "./email-template-payload";
import type { MaintenanceClientDocument } from "./types";

const makeClient = (
  overrides: Partial<MaintenanceClientDocument>,
): MaintenanceClientDocument => ({
  _id: "maintenance_client:test",
  _rev: "1-test",
  type: "maintenance_client",
  name: "Acme Industrial SRL",
  serviceAddress: {
    line1: "Str. Fagului 10",
    city: "Cluj-Napoca",
    country: "Romania",
  },
  billingAddress: null,
  primaryContactName: "Mihai Popescu",
  primaryContactTitle: null,
  counterId: "CNT-42",
  notes: null,
  customerEmail: "mihai@example.com",
  customerPhone: "+40740111222",
  contractStartDate: "2026-01-01",
  contractExpirationDate: "2026-03-30",
  contractExpirationStatus: "expiring_soon",
  contractCheckupIntervalMonths: 12,
  overhaulExpirationDate: null,
  overhaulExpirationStatus: null,
  gasSensorExpirationDate: null,
  gasSensorPeriodMonths: null,
  gasSensorExpirationStatus: null,
  createdAt: "2026-03-27T08:00:00.000Z",
  updatedAt: "2026-03-27T08:00:00.000Z",
  ...overrides,
});

describe("buildMaintenanceEmailTemplatePayload", () => {
  it("maps maintenance client and config data to required template params", () => {
    const client = makeClient({});

    const payload = buildMaintenanceEmailTemplatePayload({
      client,
      dueDate: "2026-03-30",
      category: "check_2y",
      reminderLabel: "2-year check",
      recipientRole: "customer",
      reminderText: "Reminder text",
      companyName: "GasOps SRL",
      companyAddress: "Str. Energiei 12, Cluj-Napoca",
    });

    expect(payload).toMatchObject({
      clientName: "Acme Industrial SRL",
      clientId: "maintenance_client:test",
      expirationDate: "2026-03-30",
      category: "check_2y",
      reminderLabel: "2-year check",
      recipientRole: "customer",
      reminderText: "Reminder text",
      company_name: "GasOps SRL",
      company_address: "Str. Energiei 12, Cluj-Napoca",
      customer_name: "Mihai Popescu",
      reference_number: "CNT-42",
      service_address: "Str. Fagului 10, Cluj-Napoca, Romania",
    });
  });
});
