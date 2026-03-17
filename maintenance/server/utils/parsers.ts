import { createError } from "h3";
import type {
  MaintenanceAddress,
  MaintenanceClientStatus,
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

export const asClientStatus = (value: unknown): MaintenanceClientStatus => {
  const normalized = String(value ?? "active").trim().toLowerCase();
  if (
    normalized === "active" ||
    normalized === "expiring_soon" ||
    normalized === "expired" ||
    normalized === "renewed" ||
    normalized === "discontinued"
  ) {
    return normalized;
  }
  throw createError({
    statusCode: 400,
    statusMessage: "Invalid client status",
  });
};

export const asJobStatusTransitionTarget = (value: unknown): MaintenanceJobStatus => {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "done" || normalized === "rejected") {
    return normalized;
  }
  throw createError({
    statusCode: 400,
    statusMessage: "Status transition must be done or rejected",
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
      contractCheckupIntervalMonths: null,
    };
  }

  return {
    contractStartDate: ensureIsoDateOnly(input.startDate, "contractStartDate"),
    contractExpirationDate: ensureIsoDateOnly(input.expirationDate, "contractExpirationDate"),
    contractCheckupIntervalMonths: asOptionalPositiveInteger(
      input.checkupIntervalMonths,
      "contractCheckupIntervalMonths",
    ),
  };
};
