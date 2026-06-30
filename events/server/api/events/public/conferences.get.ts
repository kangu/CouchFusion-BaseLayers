import { defineEventHandler, getQuery } from "h3";
import { getAllDocs } from "#database/utils/couchdb";
import { ensureEventsDatabase } from "../../../utils/events-db";
import type { ConferenceDocument } from "../../../utils/conference-csv";
import { getFeaturedConferencesDocument } from "../../../utils/featured-conferences";

interface PublicConference extends ConferenceDocument {
  isOnline: boolean;
}

interface PublicConferenceListResponse {
  conferences: PublicConference[];
  featured: PublicFeaturedConference[];
  meta: {
    total: number;
    onlineCount: number;
    inPersonCount: number;
    yearOptions: number[];
    continentOptions: string[];
    countryOptions: string[];
  };
}

interface PublicFeaturedConference {
  conferenceId: string;
  name: string;
  slug: string | null;
  discountCode: string | null;
  discountLabel: string | null;
  startDateIso: string | null;
  dateRangeLabel: string | null;
  location: string | null;
  city: string | null;
  country: string | null;
  continent: string | null;
  websiteUrl: string | null;
  xAccountUrl: string | null;
  isOnline: boolean;
  imageUrl: string | null;
  imageAlt: string | null;
  imageFileId: string | null;
}

const normalize = (value: unknown): string => String(value ?? "").trim().toLowerCase();
const uniqueTextOptions = (values: readonly unknown[]): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    if (typeof value !== "string") continue;
    const label = value.trim();
    if (!label.length) continue;

    const key = label.toLowerCase().replace(/\s+/g, " ");
    if (seen.has(key)) continue;

    seen.add(key);
    result.push(label);
  }

  return result.sort((left, right) => left.localeCompare(right));
};
const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const currentUtcMonthKey = (): string => {
  const now = new Date();
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

const monthKeyFromStartDate = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const dateOnlyMatch = DATE_ONLY_PATTERN.exec(trimmed);
  if (dateOnlyMatch) {
    return `${dateOnlyMatch[1]}-${dateOnlyMatch[2]}`;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const year = String(parsed.getUTCFullYear());
  const month = String(parsed.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

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
  const minimumMonthKey = currentUtcMonthKey();

  const searchFilter = normalize(query.search);
  const continentFilter = normalize(query.continent);
  const countryFilter = normalize(query.country);
  const modeFilter = normalize(query.mode);
  const yearFilter = parseYearFilter(query.year);

  const [allDocuments, featuredDocument] = await Promise.all([
    getAllDocs(databaseName, { include_docs: true }),
    getFeaturedConferencesDocument(databaseName),
  ]);

  const allPublishedConferences = (allDocuments?.rows ?? [])
    .map((row) => row.doc as ConferenceDocument | undefined)
    .filter(
      (doc): doc is ConferenceDocument =>
        Boolean(doc && doc.type === "conference" && doc._id && doc.isPublished),
    )
    .map((conference) => ({
      ...conference,
      isOnline: isOnlineConference(conference),
    }));

  const basePublishedConferences = allPublishedConferences
    .filter((conference) => {
      const monthKey = monthKeyFromStartDate(conference.startDateIso);
      if (!monthKey) {
        return false;
      }

      return monthKey >= minimumMonthKey;
    });

  const conferenceById = new Map<string, PublicConference>();
  for (const conference of allPublishedConferences) {
    conferenceById.set(conference._id, conference);
  }

  const featured = (featuredDocument?.entries ?? [])
    .filter((entry) => entry.enabled)
    .map((entry) => {
      const conference = conferenceById.get(entry.conferenceId);
      if (!conference) {
        return null;
      }

      return {
        conferenceId: conference._id,
        name: conference.name,
        slug: conference.slug ?? null,
        discountCode: conference.discountCode ?? null,
        discountLabel: conference.discountLabel ?? null,
        startDateIso: conference.startDateIso ?? null,
        dateRangeLabel: conference.dateRangeLabel ?? null,
        location: conference.location ?? null,
        city: conference.city ?? null,
        country: conference.country ?? null,
        continent: conference.continent ?? null,
        websiteUrl: conference.websiteUrl ?? null,
        xAccountUrl: conference.xAccountUrl ?? null,
        isOnline: conference.isOnline,
        imageUrl: entry.imageUrl ?? null,
        imageAlt: entry.imageAlt ?? null,
        imageFileId: entry.imageFileId ?? null,
      } as PublicFeaturedConference;
    })
    .filter(
      (entry): entry is PublicFeaturedConference =>
        Boolean(entry && entry.conferenceId),
    );

  const publishedConferences = basePublishedConferences
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
    featured,
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
      continentOptions: uniqueTextOptions(
        conferences.map((conference) => conference.continent),
      ),
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
