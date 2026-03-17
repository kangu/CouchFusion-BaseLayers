import { createError, defineEventHandler, readBody } from "h3";
import { putDocument } from "#database/utils/couchdb";
import { ensureEventsDatabase } from "../../../utils/events-db";
import { assertEventsAdminSession } from "../../../utils/assert-events-admin-session";
import {
  FEATURED_CONFERENCES_DOCUMENT_ID,
  getFeaturedConferencesDocument,
  normalizeFeaturedEntries,
  type FeaturedConferencesDocument,
} from "../../../utils/featured-conferences";

interface FeaturedConferencesPatchPayload {
  featured?: unknown;
  rev?: unknown;
}

const asOptionalRevision = (value: unknown): string | null => {
  if (typeof value === "undefined" || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw createError({
      statusCode: 400,
      statusMessage: "rev must be a string",
    });
  }

  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

export default defineEventHandler(async (event) => {
  await assertEventsAdminSession(event, ["admin", "curator"]);
  const databaseName = await ensureEventsDatabase();
  const body = await readBody<FeaturedConferencesPatchPayload>(event);

  if (!body || typeof body !== "object") {
    throw createError({
      statusCode: 400,
      statusMessage: "Request body is required",
    });
  }

  const featured = normalizeFeaturedEntries(body.featured);
  const requestedRevision = asOptionalRevision(body.rev);

  if (featured.length > 200) {
    throw createError({
      statusCode: 400,
      statusMessage: "Featured list cannot exceed 200 items",
    });
  }

  const existingDocument = await getFeaturedConferencesDocument(databaseName);
  const nowIso = new Date().toISOString();

  const nextDocument: FeaturedConferencesDocument = {
    _id: FEATURED_CONFERENCES_DOCUMENT_ID,
    type: "events_featured_conferences",
    _rev: requestedRevision ?? existingDocument?._rev,
    entries: featured,
    createdAt: existingDocument?.createdAt ?? nowIso,
    updatedAt: nowIso,
  };

  const result = await putDocument(databaseName, nextDocument);

  return {
    success: true,
    id: result.id,
    rev: result.rev,
    featured,
  };
});
