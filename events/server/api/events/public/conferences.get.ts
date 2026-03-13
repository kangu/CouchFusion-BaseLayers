import { defineEventHandler, getQuery } from "h3";
import { getAllDocs } from "#database/utils/couchdb";
import { ensureEventsDatabase } from "../../../utils/events-db";
import type { ConferenceDocument } from "../../../utils/conference-csv";

interface PublicConference extends ConferenceDocument {
  isOnline: boolean;
}

interface PublicConferenceListResponse {
  conferences: PublicConference[];
  meta: {
    total: number;
    onlineCount: number;
    inPersonCount: number;
    yearOptions: number[];
    continentOptions: string[];
    countryOptions: string[];
  };
}

const normalize = (value: unknown): string => String(value ?? "").trim().toLowerCase();

const parseYearFilter = (value: unknown): number | null => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const isOnlineConference = (conference: ConferenceDocument): boolean => {
  const haystack = [
    conference.location,
    conference.city,
    conference.country,
    conference.continent,
  ]
    .map((value) => normalize(value))
    .join(" ");

  return (
    haystack.includes("online") ||
    haystack.includes("virtual") ||
    haystack.includes("remote")
  );
};

const sortByStartDate = (conferences: PublicConference[]): PublicConference[] =>
  [...conferences].sort((left, right) => {
    if (left.startDateIso && right.startDateIso) {
      return left.startDateIso.localeCompare(right.startDateIso);
    }

    if (left.startDateIso) return -1;
    if (right.startDateIso) return 1;
    return left.name.localeCompare(right.name);
  });

export default defineEventHandler(async (event): Promise<PublicConferenceListResponse> => {
  const databaseName = await ensureEventsDatabase();
  const query = getQuery(event);

  const searchFilter = normalize(query.search);
  const continentFilter = normalize(query.continent);
  const countryFilter = normalize(query.country);
  const modeFilter = normalize(query.mode);
  const yearFilter = parseYearFilter(query.year);

  const allDocuments = await getAllDocs(databaseName, { include_docs: true });
  const publishedConferences = (allDocuments?.rows ?? [])
    .map((row) => row.doc as ConferenceDocument | undefined)
    .filter(
      (doc): doc is ConferenceDocument =>
        Boolean(doc && doc.type === "conference" && doc._id && doc.isPublished),
    )
    .map((conference) => ({
      ...conference,
      isOnline: isOnlineConference(conference),
    }))
    .filter((conference) => {
      if (!searchFilter) return true;
      const haystack = [
        conference.name,
        conference.location,
        conference.city,
        conference.country,
        conference.continent,
        conference.monthLabel,
        conference.dateRangeLabel,
      ]
        .map((value) => normalize(value))
        .join(" ");
      return haystack.includes(searchFilter);
    })
    .filter((conference) => {
      if (!continentFilter || continentFilter === "all") return true;
      return normalize(conference.continent) === continentFilter;
    })
    .filter((conference) => {
      if (!countryFilter || countryFilter === "all") return true;
      return normalize(conference.country) === countryFilter;
    })
    .filter((conference) => {
      if (!yearFilter) return true;
      return conference.year === yearFilter;
    })
    .filter((conference) => {
      if (!modeFilter || modeFilter === "all") return true;
      if (modeFilter === "online") return conference.isOnline;
      if (modeFilter === "inperson") return !conference.isOnline;
      return true;
    });

  const conferences = sortByStartDate(publishedConferences);

  return {
    conferences,
    meta: {
      total: conferences.length,
      onlineCount: conferences.filter((conference) => conference.isOnline).length,
      inPersonCount: conferences.filter((conference) => !conference.isOnline).length,
      yearOptions: Array.from(
        new Set(
          conferences
            .map((conference) => conference.year)
            .filter((year): year is number => typeof year === "number"),
        ),
      ).sort((left, right) => right - left),
      continentOptions: Array.from(
        new Set(
          conferences
            .map((conference) => conference.continent)
            .filter(
              (continent): continent is string =>
                typeof continent === "string" && continent.trim().length > 0,
            ),
        ),
      ).sort((left, right) => left.localeCompare(right)),
      countryOptions: Array.from(
        new Set(
          conferences
            .map((conference) => conference.country)
            .filter(
              (country): country is string =>
                typeof country === "string" && country.trim().length > 0,
            ),
        ),
      ).sort((left, right) => left.localeCompare(right)),
    },
  };
});
