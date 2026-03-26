import { createError, defineEventHandler, getRouterParam, readBody } from "h3";
import { getDocument, putDocument } from "#database/utils/couchdb";
import { ensureEventsDatabase } from "../../../utils/events-db";
import type { ConferenceDocument } from "../../../utils/conference-csv";
import { assertEventsAdminSession } from "../../../utils/assert-events-admin-session";
import { normalizeConferenceStatus } from "../../../utils/conference-status";
import {
  notifyConferenceWatchersViaNostr,
  previewConferenceWatchersNostrMessage,
} from "../../../utils/nostr-notifications";

type Participation = "yes" | "no" | "unknown";

interface ConferencePatchPayload {
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
  ticketsSold?: unknown;
  commissionEarnedLabel?: unknown;
  commissionReceived?: unknown;
  contactName?: unknown;
  contactChannel?: unknown;
  bitvocationParticipation?: unknown;
  status?: unknown;
  notes?: unknown;
  ownerTodo?: unknown;
  source?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
  notifyWatchers?: unknown;
  notifyMessage?: unknown;
  previewNotificationOnly?: unknown;
}

const asNullableText = (
  value: unknown,
  maxLength: number,
  fieldLabel: string,
): string | null | undefined => {
  if (typeof value === "undefined") return undefined;
  if (value === null) return null;

  if (typeof value !== "string") {
    throw createError({
      statusCode: 400,
      statusMessage: `${fieldLabel} must be a string or null`,
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

const asRequiredText = (
  value: unknown,
  maxLength: number,
  fieldLabel: string,
): string | undefined => {
  if (typeof value === "undefined") return undefined;

  if (typeof value !== "string") {
    throw createError({
      statusCode: 400,
      statusMessage: `${fieldLabel} must be a string`,
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

const asOptionalBoolean = (
  value: unknown,
  fieldLabel: string,
): boolean | undefined => {
  if (typeof value === "undefined") return undefined;
  if (typeof value !== "boolean") {
    throw createError({
      statusCode: 400,
      statusMessage: `${fieldLabel} must be a boolean`,
    });
  }
  return value;
};

const asOptionalNullableBoolean = (
  value: unknown,
  fieldLabel: string,
): boolean | null | undefined => {
  if (typeof value === "undefined") return undefined;
  if (value === null) return null;
  if (typeof value !== "boolean") {
    throw createError({
      statusCode: 400,
      statusMessage: `${fieldLabel} must be a boolean or null`,
    });
  }
  return value;
};

const asOptionalNullableInt = (
  value: unknown,
  fieldLabel: string,
): number | null | undefined => {
  if (typeof value === "undefined") return undefined;
  if (value === null) return null;

  const parsed =
    typeof value === "number"
      ? value
      : Number.parseInt(String(value).trim(), 10);

  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    throw createError({
      statusCode: 400,
      statusMessage: `${fieldLabel} must be an integer or null`,
    });
  }

  return parsed;
};

const isIsoDate = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime());
};

const asOptionalIsoDate = (
  value: unknown,
  fieldLabel: string,
): string | null | undefined => {
  if (typeof value === "undefined") return undefined;
  if (value === null) return null;

  if (typeof value !== "string") {
    throw createError({
      statusCode: 400,
      statusMessage: `${fieldLabel} must be a YYYY-MM-DD string or null`,
    });
  }

  const trimmed = value.trim();
  if (!trimmed.length) return null;

  if (!isIsoDate(trimmed)) {
    throw createError({
      statusCode: 400,
      statusMessage: `${fieldLabel} must be a valid YYYY-MM-DD value`,
    });
  }

  return trimmed;
};

const asOptionalIsoTimestamp = (
  value: unknown,
  fieldLabel: string,
): string | undefined => {
  if (typeof value === "undefined") return undefined;

  if (typeof value !== "string") {
    throw createError({
      statusCode: 400,
      statusMessage: `${fieldLabel} must be an ISO datetime string`,
    });
  }

  const trimmed = value.trim();
  if (!trimmed.length) {
    throw createError({
      statusCode: 400,
      statusMessage: `${fieldLabel} cannot be empty`,
    });
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    throw createError({
      statusCode: 400,
      statusMessage: `${fieldLabel} must be a valid datetime`,
    });
  }

  return parsed.toISOString();
};

const asOptionalParticipation = (
  value: unknown,
): Participation | undefined => {
  if (typeof value === "undefined") return undefined;

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

const asOptionalSource = (
  value: unknown,
): ConferenceDocument["source"] | undefined => {
  if (typeof value === "undefined") return undefined;

  if (!value || typeof value !== "object") {
    throw createError({
      statusCode: 400,
      statusMessage: "source must be an object",
    });
  }

  const payload = value as Record<string, unknown>;
  const format = asRequiredText(payload.format, 40, "source.format");
  const rowNumber = asOptionalNullableInt(payload.rowNumber, "source.rowNumber");
  const importedAt = asOptionalIsoTimestamp(payload.importedAt, "source.importedAt");

  if (format !== "csv-semicolon") {
    throw createError({
      statusCode: 400,
      statusMessage: "source.format must be csv-semicolon",
    });
  }

  if (typeof rowNumber !== "number" || rowNumber <= 0) {
    throw createError({
      statusCode: 400,
      statusMessage: "source.rowNumber must be a positive integer",
    });
  }

  if (!importedAt) {
    throw createError({
      statusCode: 400,
      statusMessage: "source.importedAt is required",
    });
  }

  return {
    format,
    rowNumber,
    importedAt,
  };
};

const asOptionalNotifyMessage = (value: unknown): string | undefined => {
  if (typeof value === "undefined" || value === null) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw createError({
      statusCode: 400,
      statusMessage: "notifyMessage must be a string",
    });
  }

  const trimmed = value.trim();
  if (!trimmed.length) return undefined;

  if (trimmed.length > 5000) {
    throw createError({
      statusCode: 400,
      statusMessage: "notifyMessage exceeds maximum length",
    });
  }

  return trimmed;
};

export default defineEventHandler(async (event) => {
  await assertEventsAdminSession(event, ["admin", "curator"]);
  const conferenceId = getRouterParam(event, "id", { decode: true });

  if (!conferenceId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Conference id is required",
    });
  }

  const payload = await readBody<ConferencePatchPayload>(event);
  if (!payload || typeof payload !== "object" || !Object.keys(payload).length) {
    throw createError({
      statusCode: 400,
      statusMessage: "No updatable fields provided",
    });
  }

  const name = asRequiredText(payload.name, 180, "name");
  const slug = asRequiredText(payload.slug, 220, "slug");
  const year = asOptionalNullableInt(payload.year, "year");
  const websiteUrl = asNullableText(payload.websiteUrl, 1200, "websiteUrl");
  const xAccountUrl = asNullableText(payload.xAccountUrl, 1200, "xAccountUrl");
  const location = asNullableText(payload.location, 280, "location");
  const city = asNullableText(payload.city, 180, "city");
  const monthLabel = asNullableText(payload.monthLabel, 80, "monthLabel");
  const startDateIso = asOptionalIsoDate(payload.startDateIso, "startDateIso");
  const dateRangeLabel = asNullableText(payload.dateRangeLabel, 180, "dateRangeLabel");
  const country = asNullableText(payload.country, 180, "country");
  const continent = asNullableText(payload.continent, 120, "continent");
  const hasAirtable = asOptionalBoolean(payload.hasAirtable, "hasAirtable");
  const isPublished = asOptionalBoolean(payload.isPublished, "isPublished");
  const recreateNextYear = asOptionalBoolean(
    payload.recreateNextYear,
    "recreateNextYear",
  );
  const discountCode = asNullableText(payload.discountCode, 120, "discountCode");
  const discountLabel = asNullableText(payload.discountLabel, 180, "discountLabel");
  const commissionLabel = asNullableText(payload.commissionLabel, 180, "commissionLabel");
  const ticketsSold = asOptionalNullableInt(payload.ticketsSold, "ticketsSold");
  const commissionEarnedLabel = asNullableText(
    payload.commissionEarnedLabel,
    180,
    "commissionEarnedLabel",
  );
  const commissionReceived = asOptionalNullableBoolean(
    payload.commissionReceived,
    "commissionReceived",
  );
  const contactName = asNullableText(payload.contactName, 180, "contactName");
  const contactChannel = asNullableText(payload.contactChannel, 1200, "contactChannel");
  const bitvocationParticipation = asOptionalParticipation(payload.bitvocationParticipation);
  const status = asRequiredText(payload.status, 80, "status");
  const notes = asNullableText(payload.notes, 5000, "notes");
  const ownerTodo = asNullableText(payload.ownerTodo, 5000, "ownerTodo");
  const source = asOptionalSource(payload.source);
  const createdAt = asOptionalIsoTimestamp(payload.createdAt, "createdAt");
  const updatedAt = asOptionalIsoTimestamp(payload.updatedAt, "updatedAt");
  const notifyWatchers = asOptionalBoolean(payload.notifyWatchers, "notifyWatchers");
  const notifyMessage = asOptionalNotifyMessage(payload.notifyMessage);
  const previewNotificationOnly = asOptionalBoolean(
    payload.previewNotificationOnly,
    "previewNotificationOnly",
  );

  const databaseName = await ensureEventsDatabase();
  const existingConference = await getDocument<ConferenceDocument>(
    databaseName,
    conferenceId,
  );

  if (!existingConference || existingConference.type !== "conference") {
    throw createError({
      statusCode: 404,
      statusMessage: "Conference not found",
    });
  }

  const nextConference: ConferenceDocument = {
    ...existingConference,
    name: typeof name !== "undefined" ? name : existingConference.name,
    slug: typeof slug !== "undefined" ? slug : existingConference.slug,
    year: typeof year !== "undefined" ? year : existingConference.year,
    websiteUrl:
      typeof websiteUrl !== "undefined" ? websiteUrl : existingConference.websiteUrl,
    xAccountUrl:
      typeof xAccountUrl !== "undefined" ? xAccountUrl : existingConference.xAccountUrl,
    location: typeof location !== "undefined" ? location : existingConference.location,
    city: typeof city !== "undefined" ? city : existingConference.city,
    monthLabel:
      typeof monthLabel !== "undefined" ? monthLabel : existingConference.monthLabel,
    startDateIso:
      typeof startDateIso !== "undefined" ? startDateIso : existingConference.startDateIso,
    dateRangeLabel:
      typeof dateRangeLabel !== "undefined"
        ? dateRangeLabel
        : existingConference.dateRangeLabel,
    country: typeof country !== "undefined" ? country : existingConference.country,
    continent:
      typeof continent !== "undefined" ? continent : existingConference.continent,
    hasAirtable:
      typeof hasAirtable !== "undefined" ? hasAirtable : existingConference.hasAirtable,
    isPublished:
      typeof isPublished !== "undefined" ? isPublished : existingConference.isPublished,
    recreateNextYear:
      typeof recreateNextYear !== "undefined"
        ? recreateNextYear
        : Boolean(existingConference.recreateNextYear),
    discountCode:
      typeof discountCode !== "undefined" ? discountCode : existingConference.discountCode,
    discountLabel:
      typeof discountLabel !== "undefined" ? discountLabel : existingConference.discountLabel,
    commissionLabel:
      typeof commissionLabel !== "undefined"
        ? commissionLabel
        : existingConference.commissionLabel,
    ticketsSold:
      typeof ticketsSold !== "undefined" ? ticketsSold : existingConference.ticketsSold,
    commissionEarnedLabel:
      typeof commissionEarnedLabel !== "undefined"
        ? commissionEarnedLabel
        : existingConference.commissionEarnedLabel,
    commissionReceived:
      typeof commissionReceived !== "undefined"
        ? commissionReceived
        : existingConference.commissionReceived,
    contactName:
      typeof contactName !== "undefined" ? contactName : existingConference.contactName,
    contactChannel:
      typeof contactChannel !== "undefined"
        ? contactChannel
        : existingConference.contactChannel,
    bitvocationParticipation:
      typeof bitvocationParticipation !== "undefined"
        ? bitvocationParticipation
        : existingConference.bitvocationParticipation,
    status: normalizeConferenceStatus(
      typeof status !== "undefined" ? status : existingConference.status,
    ),
    notes: typeof notes !== "undefined" ? notes : existingConference.notes,
    ownerTodo: typeof ownerTodo !== "undefined" ? ownerTodo : existingConference.ownerTodo,
    source: typeof source !== "undefined" ? source : existingConference.source,
    createdAt: typeof createdAt !== "undefined" ? createdAt : existingConference.createdAt,
    updatedAt: typeof updatedAt !== "undefined" ? updatedAt : new Date().toISOString(),
  };
  delete (nextConference as { startDateLabel?: unknown }).startDateLabel;

  if (previewNotificationOnly === true) {
    if (notifyWatchers !== true) {
      throw createError({
        statusCode: 400,
        statusMessage:
          "notifyWatchers must be true when previewNotificationOnly is enabled",
      });
    }

    const notificationPreview = await previewConferenceWatchersNostrMessage(
      existingConference,
      nextConference,
      { customMessage: notifyMessage },
    );

    return {
      success: true,
      id: existingConference._id,
      rev: existingConference._rev,
      conference: nextConference,
      notificationPreview,
    };
  }

  let notifyResult:
    | {
        requested: boolean;
        eligible: number;
        sent: number;
        failed: number;
        failures: Array<{ npub: string; reason: string }>;
      }
    | null = null;

  if (notifyWatchers === true) {
    notifyResult = await notifyConferenceWatchersViaNostr(
      existingConference,
      nextConference,
      { customMessage: notifyMessage },
    );

    if (notifyResult.failed > 0) {
      throw createError({
        statusCode: 502,
        statusMessage: `Failed to notify ${notifyResult.failed} watcher(s). Save aborted before persistence.`,
      });
    }
  }

  const result = await putDocument(databaseName, nextConference);
  const persistedConference = await getDocument<ConferenceDocument>(
    databaseName,
    result.id,
  );

  if (!persistedConference || persistedConference.type !== "conference") {
    throw createError({
      statusCode: 500,
      statusMessage: "Conference saved but could not be reloaded from database",
    });
  }

  return {
    success: true,
    id: result.id,
    rev: result.rev,
    notifiedWatchers: notifyResult,
    conference: persistedConference,
  };
});
