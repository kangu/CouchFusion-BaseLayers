import { defineEventHandler, getQuery } from "h3";
import { getView } from "#database/utils/couchdb";
import { ensureEventsDatabase } from "../../../utils/events-db";
import type { ConferenceDocument } from "../../../utils/conference-csv";
import { assertEventsAdminSession } from "../../../utils/assert-events-admin-session";

interface ConferenceListResponse {
  conferences: ConferenceDocument[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  statusCounts: Record<string, number>;
  publicationCounts: {
    published: number;
    draft: number;
  };
  yearOptions: number[];
  continentOptions: string[];
}

const parsePositiveInt = (value: unknown, fallback: number, max: number) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(parsed, max);
};

const normalize = (value: unknown) => String(value ?? "").trim().toLowerCase();

const buildStatusCounts = (
  conferences: ConferenceDocument[],
): Record<string, number> => {
  const counts: Record<string, number> = {};

  for (const conference of conferences) {
    const key = conference.status || "Unknown";
    counts[key] = (counts[key] || 0) + 1;
  }

  return counts;
};

export default defineEventHandler(async (event): Promise<ConferenceListResponse> => {
  await assertEventsAdminSession(event, ["admin", "curator"]);
  const databaseName = await ensureEventsDatabase();
  const query = getQuery(event);

  const search = normalize(query.search);
  const statusFilter = normalize(query.status);
  const continentFilter = normalize(query.continent);
  const publishedFilter = normalize(query.published);
  const yearFilter = parsePositiveInt(query.year, 0, 9999);

  const page = parsePositiveInt(query.page, 1, 10_000);
  const pageSize = parsePositiveInt(query.pageSize, 24, 200);

  const view = await getView(databaseName, "conferences", "by_start_date", {
    include_docs: true,
    descending: false,
  });

  const allConferences = (view?.rows ?? [])
    .map((row) => row.doc as ConferenceDocument | undefined)
    .filter(
      (doc): doc is ConferenceDocument =>
        Boolean(doc && doc.type === "conference" && doc._id),
    )
    .filter((doc) => {
      if (!search) return true;
      const haystack = [
        doc.name,
        doc.location,
        doc.country,
        doc.continent,
        doc.status,
        doc.notes,
      ]
        .map((value) => normalize(value))
        .join(" ");
      return haystack.includes(search);
    })
    .filter((doc) => {
      if (!statusFilter || statusFilter === "all") return true;
      return normalize(doc.status) === statusFilter;
    })
    .filter((doc) => {
      if (!yearFilter) return true;
      return doc.year === yearFilter;
    })
    .filter((doc) => {
      if (!publishedFilter || publishedFilter === "all") return true;
      if (publishedFilter === "published") return doc.isPublished === true;
      if (publishedFilter === "draft") return doc.isPublished !== true;
      return true;
    });

  const conferences = allConferences.filter((doc) => {
    if (!continentFilter || continentFilter === "all") return true;
    return normalize(doc.continent) === continentFilter;
  });

  const total = conferences.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageStart = (page - 1) * pageSize;
  const paginatedConferences = conferences.slice(pageStart, pageStart + pageSize);

  const yearOptions = Array.from(
    new Set(
      conferences
        .map((conference) => conference.year)
        .filter((year): year is number => typeof year === "number"),
    ),
  ).sort((left, right) => right - left);

  const continentOptions = Array.from(
    new Set(
      allConferences
        .map((conference) => conference.continent)
        .filter(
          (continent): continent is string =>
            typeof continent === "string" && continent.trim().length > 0,
        ),
    ),
  ).sort((left, right) => left.localeCompare(right));

  return {
    conferences: paginatedConferences,
    total,
    page,
    pageSize,
    totalPages,
    statusCounts: buildStatusCounts(conferences),
    publicationCounts: {
      published: conferences.filter((conference) => conference.isPublished).length,
      draft: conferences.filter((conference) => !conference.isPublished).length,
    },
    yearOptions,
    continentOptions,
  };
});
