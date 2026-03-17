import { createError } from "h3";
import { getDocument } from "#database/utils/couchdb";
import { ensureEventsDatabase } from "./events-db";
import type { ConferenceDocument } from "./conference-csv";

export const requireConferenceDocument = async (
  conferenceId: string,
): Promise<ConferenceDocument> => {
  const databaseName = await ensureEventsDatabase();
  const conference = await getDocument<ConferenceDocument>(databaseName, conferenceId);

  if (!conference || conference.type !== "conference") {
    throw createError({
      statusCode: 404,
      statusMessage: "Conference not found",
    });
  }

  return conference;
};
