import { defineEventHandler } from "h3";
import { getView } from "#database/utils/couchdb";
import { ensureEventsDatabase } from "../../../utils/events-db";
import type { ConferenceDocument } from "../../../utils/conference-csv";
import { assertEventsAdminSession } from "../../../utils/assert-events-admin-session";
import { getFeaturedConferencesDocument } from "../../../utils/featured-conferences";

interface FeaturedConferenceSummary {
  _id: string;
  name: string;
  startDateIso: string | null;
  city: string | null;
  location: string | null;
  country: string | null;
  isPublished: boolean;
}

interface FeaturedConferenceResponse {
  rev: string | null;
  featured: {
    conferenceId: string;
    enabled: boolean;
    imageUrl: string | null;
    imageFileId: string | null;
    imageAlt: string | null;
  }[];
  conferences: FeaturedConferenceSummary[];
}

export default defineEventHandler(async (event): Promise<FeaturedConferenceResponse> => {
  await assertEventsAdminSession(event, ["admin", "curator"]);
  const databaseName = await ensureEventsDatabase();

  const [view, featuredDocument] = await Promise.all([
    getView(databaseName, "conferences", "by_start_date", {
      include_docs: true,
      descending: false,
    }),
    getFeaturedConferencesDocument(databaseName),
  ]);

  const conferences = (view?.rows ?? [])
    .map((row) => row.doc as ConferenceDocument | undefined)
    .filter(
      (doc): doc is ConferenceDocument =>
        Boolean(doc && doc.type === "conference" && doc._id),
    )
    .map((conference) => ({
      _id: conference._id,
      name: conference.name,
      startDateIso: conference.startDateIso ?? null,
      city: conference.city ?? null,
      location: conference.location ?? null,
      country: conference.country ?? null,
      isPublished: conference.isPublished === true,
    }));

  return {
    rev: featuredDocument?._rev ?? null,
    featured: featuredDocument?.entries ?? [],
    conferences,
  };
});
