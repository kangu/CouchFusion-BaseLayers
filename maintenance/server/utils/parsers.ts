import { createError } from "h3";
import type {
  MaintenanceAddress,
  MaintenanceExpirationStatus,
  MaintenanceJobStatus,
} from "./types";
import { ensureIsoDateOnly } from "./dates";

export const asOptionalText = (
  value: unknown,
  maxLength: number,
  fieldLabel: string,
): string | null => {
  if (typeof value === "undefined" || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw createError({
      statusCode: 400,
      statusMessage: `${fieldLabel} must be a string`,
    });
  }

  const trimmed = value.trim();
  if (!trimmed.length) {
    return null;
  }

  if (trimmed.length > maxLength) {
    throw createError({
      statusCode: 400,
      statusMessage: `${fieldLabel} exceeds maximum length`,
    });
  }

  return trimmed;
};

export const asRequiredText = (
  value: unknown,
  maxLength: number,
  fieldLabel: string,
): string => {
  const result = asOptionalText(value, maxLength, fieldLabel);
  if (!result) {
    throw createError({
      statusCode: 400,
      statusMessage: `${fieldLabel} is required`,
    });
  }
  return result;
};

export const asOptionalPositiveInteger = (
  value: unknown,
  fieldLabel: string,
): number | null => {
  if (typeof value === "undefined" || value === null || value === "") {
    return null;
  }

  const parsed =
    typeof value === "number"
      ? value
      : Number.parseInt(String(value).trim(), 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw createError({
      statusCode: 400,
      statusMessage: `${fieldLabel} must be a positive integer`,
    });
  }

  return parsed;
};

export const asExpirationStatus = (value: unknown): MaintenanceExpirationStatus => {
  const normalized = String(value ?? "active").trim().toLowerCase();
  if (
    normalized === "active" ||
    normalized === "expiring_soon" ||
    normalized === "expired" ||
    normalized === "renewed"
  ) {
    return normalized;
  }
  throw createError({
    statusCode: 400,
    statusMessage: "Invalid expiration status",
  });
};

export const asJobStatusTransitionTarget = (value: unknown): MaintenanceJobStatus => {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (
    normalized === "scheduled" ||
    normalized === "canceled_by_customer" ||
    normalized === "done" ||
    normalized === "rejected"
  ) {
    return normalized;
  }
  throw createError({
    statusCode: 400,
    statusMessage:
      "Status transition must be scheduled, canceled_by_customer, done or rejected",
  });
};

export const parseAddress = (
  value: unknown,
  fieldLabel: string,
): MaintenanceAddress | null => {
  if (typeof value === "undefined" || value === null) {
    return null;
  }

  if (typeof value !== "object") {
    throw createError({
      statusCode: 400,
      statusMessage: `${fieldLabel} must be an object`,
    });
  }

  const payload = value as Record<string, unknown>;
  const line1 = asRequiredText(payload.line1, 240, `${fieldLabel}.line1`);

  return {
    line1,
    line2: asOptionalText(payload.line2, 240, `${fieldLabel}.line2`),
    city: asOptionalText(payload.city, 120, `${fieldLabel}.city`),
    state: asOptionalText(payload.state, 120, `${fieldLabel}.state`),
    postalCode: asOptionalText(payload.postalCode, 60, `${fieldLabel}.postalCode`),
    country: asOptionalText(payload.country, 120, `${fieldLabel}.country`),
  };
};

interface ParseClientContractFieldsInput {
  startDate?: unknown;
  expirationDate?: unknown;
  checkupIntervalMonths?: unknown;
}

export const parseClientContractFields = (
  input: ParseClientContractFieldsInput,
): {
  contractStartDate: string | null;
  contractExpirationDate: string | null;
  contractExpirationStatus: MaintenanceExpirationStatus | null;
  contractCheckupIntervalMonths: number | null;
} => {
  const hasStartDate = typeof input.startDate !== "undefined" && input.startDate !== null && input.startDate !== "";
  const hasExpirationDate =
    typeof input.expirationDate !== "undefined" &&
    input.expirationDate !== null &&
    input.expirationDate !== "";

  if (hasStartDate !== hasExpirationDate) {
    throw createError({
      statusCode: 400,
      statusMessage: "contractStartDate and contractExpirationDate must be provided together",
    });
  }

  if (!hasStartDate) {
    return {
      contractStartDate: null,
      contractExpirationDate: null,
      contractExpirationStatus: null,
      contractCheckupIntervalMonths: null,
    };
  }

  return {
    contractStartDate: ensureIsoDateOnly(input.startDate, "contractStartDate"),
    contractExpirationDate: ensureIsoDateOnly(input.expirationDate, "contractExpirationDate"),
    contractExpirationStatus: "active",
    contractCheckupIntervalMonths: 12,
  };
};

interface ParseClientScheduleFieldsInput {
  overhaulExpirationDate?: unknown;
  gasSensorExpirationDate?: unknown;
  overhaulExpirationStatus?: unknown;
  gasSensorExpirationStatus?: unknown;
  gasSensorPeriodMonths?: unknown;
  legacyOverhaulBaseDate?: unknown;
  legacyOverhaulDueDate?: unknown;
  legacyGasSensorBaseDate?: unknown;
  legacyGasSensorDueDate?: unknown;
}

export const parseClientScheduleFields = (
  input: ParseClientScheduleFieldsInput,
): {
  overhaulExpirationDate: string | null;
  overhaulExpirationStatus: MaintenanceExpirationStatus | null;
  gasSensorExpirationDate: string | null;
  gasSensorExpirationStatus: MaintenanceExpirationStatus | null;
  gasSensorPeriodMonths: number | null;
} => {
  const rawOverhaulExpirationDate =
    typeof input.overhaulExpirationDate !== "undefined"
      ? input.overhaulExpirationDate
      : typeof input.legacyOverhaulDueDate !== "undefined"
        ? input.legacyOverhaulDueDate
        : input.legacyOverhaulBaseDate;

  const overhaulExpirationDate =
    typeof rawOverhaulExpirationDate === "undefined" ||
    rawOverhaulExpirationDate === null ||
    rawOverhaulExpirationDate === ""
      ? null
      : ensureIsoDateOnly(rawOverhaulExpirationDate, "overhaulExpirationDate");

  const rawGasSensorExpirationDate =
    typeof input.gasSensorExpirationDate !== "undefined"
      ? input.gasSensorExpirationDate
      : typeof input.legacyGasSensorDueDate !== "undefined"
        ? input.legacyGasSensorDueDate
        : input.legacyGasSensorBaseDate;

  const gasSensorExpirationDate =
    typeof rawGasSensorExpirationDate === "undefined" ||
    rawGasSensorExpirationDate === null ||
    rawGasSensorExpirationDate === ""
      ? null
      : ensureIsoDateOnly(rawGasSensorExpirationDate, "gasSensorExpirationDate");

  const gasSensorPeriodMonths = asOptionalPositiveInteger(
    input.gasSensorPeriodMonths,
    "gasSensorPeriodMonths",
  );

  const hasGasSensorExpirationDate = Boolean(gasSensorExpirationDate);
  const hasGasSensorPeriodMonths = Boolean(gasSensorPeriodMonths);

  if (hasGasSensorExpirationDate !== hasGasSensorPeriodMonths) {
    throw createError({
      statusCode: 400,
      statusMessage:
        "gasSensorExpirationDate and gasSensorPeriodMonths must be provided together",
    });
  }

  const overhaulExpirationStatus =
    overhaulExpirationDate === null
      ? null
      : typeof input.overhaulExpirationStatus === "undefined"
        ? "active"
        : asExpirationStatus(input.overhaulExpirationStatus);
  const gasSensorExpirationStatus =
    gasSensorExpirationDate === null
      ? null
      : typeof input.gasSensorExpirationStatus === "undefined"
        ? "active"
        : asExpirationStatus(input.gasSensorExpirationStatus);

  return {
    overhaulExpirationDate,
    overhaulExpirationStatus,
    gasSensorExpirationDate,
    gasSensorExpirationStatus,
    gasSensorPeriodMonths,
  };
};
