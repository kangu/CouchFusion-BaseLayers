import { createError } from "h3";

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export const ensureIsoDateOnly = (
  value: unknown,
  fieldLabel: string,
): string => {
  if (typeof value !== "string") {
    throw createError({
      statusCode: 400,
      statusMessage: `${fieldLabel} is required`,
    });
  }

  const trimmed = value.trim();
  const match = DATE_ONLY_PATTERN.exec(trimmed);
  if (!match) {
    throw createError({
      statusCode: 400,
      statusMessage: `${fieldLabel} must use YYYY-MM-DD format`,
    });
  }

  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);
  const probe = new Date(Date.UTC(year, month - 1, day));

  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    throw createError({
      statusCode: 400,
      statusMessage: `${fieldLabel} is not a valid date`,
    });
  }

  return trimmed;
};

export const ensureIsoDateOrDateTime = (
  value: unknown,
  fieldLabel: string,
): string => {
  if (typeof value !== "string") {
    throw createError({
      statusCode: 400,
      statusMessage: `${fieldLabel} is required`,
    });
  }

  const trimmed = value.trim();
  if (DATE_ONLY_PATTERN.test(trimmed)) {
    return ensureIsoDateOnly(trimmed, fieldLabel);
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    throw createError({
      statusCode: 400,
      statusMessage: `${fieldLabel} must be a valid ISO date or datetime`,
    });
  }

  return parsed.toISOString();
};

export const toIsoDateOnly = (date: Date): string => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const addDaysUtc = (date: Date, days: number): Date => {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

export const addMonthsToIsoDate = (value: string, months: number): string => {
  const [year, month, day] = value.split("-").map((part) => Number.parseInt(part, 10));
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCMonth(date.getUTCMonth() + months);
  return toIsoDateOnly(date);
};
