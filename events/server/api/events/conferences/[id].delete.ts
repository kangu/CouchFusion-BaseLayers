import { createError, defineEventHandler, getRouterParam } from "h3";
import { deleteDocument, getDocument } from "#database/utils/couchdb";
import { ensureEventsDatabase } from "../../../utils/events-db";
import type { ConferenceDocument } from "../../../utils/conference-csv";
import { assertEventsAdminSession } from "../../../utils/assert-events-admin-session";

export default defineEventHandler(async (event) => {
  await assertEventsAdminSession(event, ["admin", "curator"]);
  const conferenceId = getRouterParam(event, "id", { decode: true });

  if (!conferenceId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Conference id is required",
    });
  }

  const databaseName = await ensureEventsDatabase();
  const conference = await getDocument<ConferenceDocument>(databaseName, conferenceId);

  if (!conference || conference.type !== "conference") {
    throw createError({
      statusCode: 404,
      statusMessage: "Conference not found",
    });
  }

  if (!conference._rev) {
    throw createError({
      statusCode: 409,
      statusMessage: "Conference revision is required for deletion",
    });
  }

  await deleteDocument(databaseName, conference._id, conference._rev);

  return {
    success: true,
    id: conference._id,
  };
});
