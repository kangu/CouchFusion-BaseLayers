import { createError, defineEventHandler, readBody } from "h3";
import { getDocument, putDocument } from "#database/utils/couchdb";
import { ensureEventsDatabase } from "../../../utils/events-db";
import type { ConferenceDocument } from "../../../utils/conference-csv";
import { assertEventsAdminSession } from "../../../utils/assert-events-admin-session";
import { normalizeConferenceStatus } from "../../../utils/conference-status";

type Participation = "yes" | "no" | "unknown";

interface ConferenceCreatePayload {
  name?: unknown;
  slug?: unknown;
  year?: unknown;
  websiteUrl?: unknown;
  xAccountUrl?: unknown;
  location?: unknown;
  city?: unknown;
  monthLabel?: unknown;
  startDateIso?: unknown;
  dateRangeLabel?: unknown;
  country?: unknown;
  continent?: unknown;
  hasAirtable?: unknown;
  isPublished?: unknown;
  recreateNextYear?: unknown;
  discountCode?: unknown;
  discountLabel?: unknown;
  commissionLabel?: unknown;
  contactName?: unknown;
  contactChannel?: unknown;
  bitvocationParticipation?: unknown;
  status?: unknown;
  notes?: unknown;
  ownerTodo?: unknown;
}

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const asRequiredText = (
  value: unknown,
  maxLength: number,
  fieldLabel: string,
): string => {
  if (typeof value !== "string") {
    throw createError({
      statusCode: 400,
      statusMessage: `${fieldLabel} is required`,
    });
  }

  const trimmed = value.trim();
  if (!trimmed.length) {
    throw createError({
      statusCode: 400,
      statusMessage: `${fieldLabel} cannot be empty`,
    });
  }

  if (trimmed.length > maxLength) {
    throw createError({
      statusCode: 400,
      statusMessage: `${fieldLabel} exceeds maximum length`,
    });
  }

  return trimmed;
};

const asNullableText = (
  value: unknown,
  maxLength: number,
  fieldLabel: string,
): string | null => {
  if (typeof value === "undefined" || value === null) return null;

  if (typeof value !== "string") {
    throw createError({
      statusCode: 400,
      statusMessage: `${fieldLabel} must be a string`,
    });
  }

  const trimmed = value.trim();
  if (!trimmed.length) return null;

  if (trimmed.length > maxLength) {
    throw createError({
      statusCode: 400,
      statusMessage: `${fieldLabel} exceeds maximum length`,
    });
  }

  return trimmed;
};

const asRequiredPositiveInt = (value: unknown, fieldLabel: string): number => {
  const parsed =
    typeof value === "number"
      ? value
      : Number.parseInt(String(value ?? "").trim(), 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw createError({
      statusCode: 400,
      statusMessage: `${fieldLabel} must be a positive integer`,
    });
  }

  return parsed;
};

const asOptionalBoolean = (
  value: unknown,
  fallback: boolean,
  fieldLabel: string,
): boolean => {
  if (typeof value === "undefined") return fallback;
  if (typeof value !== "boolean") {
    throw createError({
      statusCode: 400,
      statusMessage: `${fieldLabel} must be a boolean`,
    });
  }
  return value;
};

const asOptionalParticipation = (value: unknown): Participation => {
  if (typeof value === "undefined" || value === null) {
    return "unknown";
  }

  if (typeof value !== "string") {
    throw createError({
      statusCode: 400,
      statusMessage: "bitvocationParticipation must be yes, no, or unknown",
    });
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "yes" || normalized === "no" || normalized === "unknown") {
    return normalized;
  }

  throw createError({
    statusCode: 400,
    statusMessage: "bitvocationParticipation must be yes, no, or unknown",
  });
};

const asOptionalIsoDate = (value: unknown, fieldLabel: string): string | null => {
  if (typeof value === "undefined" || value === null) return null;
  if (typeof value !== "string") {
    throw createError({
      statusCode: 400,
      statusMessage: `${fieldLabel} must be a YYYY-MM-DD string or null`,
    });
  }

  const trimmed = value.trim();
  if (!trimmed.length) return null;
  const match = DATE_ONLY_PATTERN.exec(trimmed);
  if (!match) {
    throw createError({
      statusCode: 400,
      statusMessage: `${fieldLabel} must be in YYYY-MM-DD format`,
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
      statusMessage: `${fieldLabel} is not a valid calendar date`,
    });
  }

  return trimmed;
};

const toSlug = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const deriveStartDateLabel = (startDateIso: string): string => {
  const [yearStr, monthStr, dayStr] = startDateIso.split("-");
  const year = Number.parseInt(yearStr, 10);
  const month = Number.parseInt(monthStr, 10);
  const day = Number.parseInt(dayStr, 10);
  const date = new Date(Date.UTC(year, month - 1, day));

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
};

const deriveMonthLabel = (startDateIso: string): string => {
  const [yearStr, monthStr] = startDateIso.split("-");
  const year = Number.parseInt(yearStr, 10);
  const month = Number.parseInt(monthStr, 10);
  const date = new Date(Date.UTC(year, month - 1, 1));
  const shortMonth = new Intl.DateTimeFormat("en", {
    month: "short",
    timeZone: "UTC",
  }).format(date);

  return `${String(month).padStart(2, "0")} ${shortMonth}`;
};

export default defineEventHandler(async (event) => {
  await assertEventsAdminSession(event, ["admin", "curator"]);

  const payload = await readBody<ConferenceCreatePayload>(event);
  if (!payload || typeof payload !== "object") {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid request payload",
    });
  }

  const name = asRequiredText(payload.name, 180, "name");
  const slug = asNullableText(payload.slug, 220, "slug");
  const year = asRequiredPositiveInt(payload.year, "year");
  const startDateIso = asOptionalIsoDate(payload.startDateIso, "startDateIso");

  const normalizedSlug = slug ?? toSlug(name);
  if (!normalizedSlug.length) {
    throw createError({
      statusCode: 400,
      statusMessage: "slug is required",
    });
  }

  const documentId = ["conference", year, normalizedSlug].join(":");
  const databaseName = await ensureEventsDatabase();
  const existing = await getDocument<ConferenceDocument>(databaseName, documentId);
  if (existing) {
    throw createError({
      statusCode: 409,
      statusMessage: `Conference already exists (${documentId})`,
    });
  }

  const now = new Date().toISOString();
  const conference: ConferenceDocument = {
    _id: documentId,
    type: "conference",
    name,
    slug: normalizedSlug,
    year,
    websiteUrl: asNullableText(payload.websiteUrl, 1200, "websiteUrl"),
    xAccountUrl: asNullableText(payload.xAccountUrl, 1200, "xAccountUrl"),
    location: asNullableText(payload.location, 280, "location"),
    city: asNullableText(payload.city, 180, "city"),
    monthLabel:
      asNullableText(payload.monthLabel, 80, "monthLabel") ??
      (startDateIso ? deriveMonthLabel(startDateIso) : null),
    startDateIso,
    dateRangeLabel:
      asNullableText(payload.dateRangeLabel, 180, "dateRangeLabel") ??
      (startDateIso ? deriveStartDateLabel(startDateIso) : null),
    country: asNullableText(payload.country, 180, "country"),
    continent: asNullableText(payload.continent, 120, "continent"),
    hasAirtable: asOptionalBoolean(payload.hasAirtable, false, "hasAirtable"),
    isPublished: asOptionalBoolean(payload.isPublished, false, "isPublished"),
    recreateNextYear: asOptionalBoolean(
      payload.recreateNextYear,
      false,
      "recreateNextYear",
    ),
    discountCode: asNullableText(payload.discountCode, 120, "discountCode"),
    discountLabel: asNullableText(payload.discountLabel, 180, "discountLabel"),
    commissionLabel: asNullableText(payload.commissionLabel, 180, "commissionLabel"),
    ticketsSold: null,
    commissionEarnedLabel: null,
    commissionReceived: null,
    contactName: asNullableText(payload.contactName, 180, "contactName"),
    contactChannel: asNullableText(payload.contactChannel, 1200, "contactChannel"),
    bitvocationParticipation: asOptionalParticipation(payload.bitvocationParticipation),
    status: normalizeConferenceStatus(asNullableText(payload.status, 80, "status")),
    notes: asNullableText(payload.notes, 5000, "notes"),
    ownerTodo: asNullableText(payload.ownerTodo, 5000, "ownerTodo"),
    source: {
      format: "csv-semicolon",
      rowNumber: Math.floor(Date.now() / 1000),
      importedAt: now,
    },
    createdAt: now,
    updatedAt: now,
  };

  const result = await putDocument(databaseName, conference);

  return {
    success: true,
    id: result.id,
    rev: result.rev,
    conference: {
      ...conference,
      _rev: result.rev,
    },
  };
});
