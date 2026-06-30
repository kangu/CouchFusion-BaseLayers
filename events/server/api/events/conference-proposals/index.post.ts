import { createError, defineEventHandler, readBody } from "h3";
import { getDocument, putDocument } from "#database/utils/couchdb";
import { requireAuthenticatedUser } from "#auth/server/utils/authenticated-user";
import { ensureEventsDatabase } from "../../../utils/events-db";
import {
  CONFERENCE_PROPOSAL_STATUS_PENDING,
  CONFERENCE_PROPOSAL_TYPE,
  type ConferenceProposalDocument,
} from "../../../utils/conference-proposal";

interface ConferenceProposalCreatePayload {
  name?: unknown;
  websiteUrl?: unknown;
  location?: unknown;
  city?: unknown;
  country?: unknown;
  continent?: unknown;
  region?: unknown;
  startDateIso?: unknown;
  recreateNextYear?: unknown;
  discountCode?: unknown;
  discountPercent?: unknown;
  discountLabel?: unknown;
  commissionPercent?: unknown;
  commissionLabel?: unknown;
  logoUrl?: unknown;
  logoFileId?: unknown;
  organizerName?: unknown;
  contactEmail?: unknown;
  xAccountUrl?: unknown;
  interestedInAdvertising?: unknown;
  notes?: unknown;
}

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

const asRequiredEmail = (value: unknown): string => {
  const email = asRequiredText(value, 320, "contactEmail");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw createError({
      statusCode: 400,
      statusMessage: "contactEmail must be a valid email address",
    });
  }
  return email;
};

const asOptionalBoolean = (
  value: unknown,
  fallback: boolean,
  fieldLabel: string,
): boolean => {
  if (typeof value === "undefined" || value === null) return fallback;
  if (typeof value !== "boolean") {
    throw createError({
      statusCode: 400,
      statusMessage: `${fieldLabel} must be a boolean`,
    });
  }
  return value;
};

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const asOptionalIsoDate = (value: unknown): string | null => {
  const normalized = asNullableText(value, 30, "startDateIso");
  if (!normalized) return null;
  if (!DATE_ONLY_PATTERN.test(normalized)) {
    throw createError({
      statusCode: 400,
      statusMessage: "startDateIso must be in YYYY-MM-DD format",
    });
  }
  return normalized;
};

const toSlug = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export default defineEventHandler(async (event) => {
  const { userDoc, session } = await requireAuthenticatedUser(event);
  const payload = await readBody<ConferenceProposalCreatePayload>(event);

  if (!payload || typeof payload !== "object") {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid request payload",
    });
  }

  const name = asRequiredText(payload.name, 180, "name");
  const websiteUrl = asNullableText(payload.websiteUrl, 1200, "websiteUrl");
  const city = asNullableText(payload.city, 180, "city");
  const country = asNullableText(payload.country, 180, "country");
  const region =
    asNullableText(payload.region, 120, "region") ??
    asNullableText(payload.continent, 120, "continent");
  const startDateIso = asOptionalIsoDate(payload.startDateIso);
  const recreateNextYear = asOptionalBoolean(
    payload.recreateNextYear,
    false,
    "recreateNextYear",
  );
  const discountCode = asRequiredText(payload.discountCode, 120, "discountCode");
  const discountLabel = asRequiredText(
    typeof payload.discountLabel === "undefined"
      ? payload.discountPercent
      : payload.discountLabel,
    180,
    "discountPercent",
  );
  const commissionLabel = asRequiredText(
    typeof payload.commissionLabel === "undefined"
      ? payload.commissionPercent
      : payload.commissionLabel,
    180,
    "commissionPercent",
  );
  const logoUrl = asNullableText(payload.logoUrl, 1200, "logoUrl");
  const logoFileId = asNullableText(payload.logoFileId, 280, "logoFileId");
  const organizerName = asRequiredText(payload.organizerName, 180, "organizerName");
  const contactEmail = asRequiredEmail(payload.contactEmail);
  const xAccountUrl = asNullableText(payload.xAccountUrl, 1200, "xAccountUrl");
  const interestedInAdvertising = asOptionalBoolean(
    payload.interestedInAdvertising,
    false,
    "interestedInAdvertising",
  );
  const notes = asNullableText(payload.notes, 3000, "notes");

  const userDocumentId = userDoc?._id || `org.couchdb.user:${session.userCtx.name}`;
  const persistedUserDoc = await getDocument<Record<string, unknown>>(
    "_users",
    userDocumentId,
  );
  if (!persistedUserDoc) {
    throw createError({
      statusCode: 404,
      statusMessage: "User document not found",
    });
  }

  const conferenceSubmissionStatus = String(
    persistedUserDoc.conference_submission_status ?? "",
  )
    .trim()
    .toLowerCase();

  if (conferenceSubmissionStatus !== "paid") {
    throw createError({
      statusCode: 402,
      statusMessage:
        "Conference submission requires a paid lightning invoice. Please complete payment first.",
    });
  }

  const now = new Date().toISOString();
  const randomTail = Math.random().toString(36).slice(2, 9);
  const proposalId = [
    "conference-proposal",
    now.slice(0, 10),
    toSlug(name) || "proposal",
    randomTail,
  ].join(":");

  const proposal: ConferenceProposalDocument = {
    _id: proposalId,
    type: CONFERENCE_PROPOSAL_TYPE,
    status: CONFERENCE_PROPOSAL_STATUS_PENDING,
    name,
    websiteUrl,
    location: null,
    city,
    country,
    continent: region,
    region,
    startDateIso,
    recreateNextYear,
    discountCode,
    discountLabel,
    commissionLabel,
    logoUrl,
    logoFileId,
    organizerName,
    contactEmail,
    xAccountUrl,
    interestedInAdvertising,
    notes,
    conferenceId: null,
    submittedBy: {
      username: session.userCtx.name,
      userDocId: userDoc._id,
    },
    createdAt: now,
    updatedAt: now,
    resolvedAt: null,
  };

  const databaseName = await ensureEventsDatabase();
  const nextUserDocument = {
    ...persistedUserDoc,
    conference_submission_status: "pending",
    conference_submission_invoice: "",
  };

  // Consume payment first so one paid status can create only one proposal.
  const consumeResult = await putDocument("_users", nextUserDocument);
  const rollbackUserDocument = {
    ...persistedUserDoc,
    _rev: consumeResult.rev,
  };

  let result;
  try {
    result = await putDocument(databaseName, proposal);
  } catch (proposalError) {
    // Best-effort rollback in case proposal persistence fails after consume.
    try {
      await putDocument("_users", rollbackUserDocument);
    } catch (rollbackError) {
      console.warn(
        "Conference proposal rollback failed after payment consume",
        rollbackError,
      );
    }

    throw proposalError;
  }

  return {
    success: true,
    id: result.id,
    rev: result.rev,
    proposal: {
      ...proposal,
      _rev: result.rev,
    },
  };
});
