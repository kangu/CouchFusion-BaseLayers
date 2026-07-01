import { defineEventHandler, getQuery } from "h3";
import { getView } from "#database/utils/couchdb";
import { ensureEventsDatabase } from "../../../utils/events-db";
import type { ConferenceDocument } from "../../../utils/conference-csv";
import { assertEventsAdminSession } from "../../../utils/assert-events-admin-session";
import {
  CONFERENCE_STATUS_IN_PROGRESS,
  normalizeConferenceStatus,
} from "../../../utils/conference-status";

interface ConferenceListResponse {
  conferences: ConferenceDocument[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  unfilteredCounts: {
    total: number;
    inProgress: number;
    published: number;
    draft: number;
  };
  statusCounts: Record<string, number>;
  publicationCounts: {
    published: number;
    draft: number;
  };
  yearOptions: number[];
  continentOptions: string[];
}

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const parsePositiveInt = (value: unknown, fallback: number, max: number) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(parsed, max);
};
const parseYearFilter = (
  value: unknown,
): number | "tba" | null => {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized || normalized === "all") return null;
  if (normalized === "tba") return "tba";

  const parsed = Number.parseInt(normalized, 10);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 9999) {
    return null;
  }

  return parsed;
};

const normalize = (value: unknown) => String(value ?? "").trim().toLowerCase();
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
const parseBoolean = (value: unknown, fallback: boolean): boolean => {
  if (typeof value === "boolean") return value;
  const normalized = normalize(value);
  if (!normalized.length) return fallback;
  if (normalized === "true" || normalized === "1" || normalized === "yes") return true;
  if (normalized === "false" || normalized === "0" || normalized === "no") return false;
  return fallback;
};
const currentUtcDateOnly = (): string => {
  const now = new Date();
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
const isPastConference = (conference: ConferenceDocument): boolean => {
  const startDateIso = String(conference.startDateIso ?? "").trim();
  if (!startDateIso) return false;

  if (DATE_ONLY_PATTERN.test(startDateIso)) {
    return startDateIso < currentUtcDateOnly();
  }

  const parsed = new Date(startDateIso);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }

  return parsed.getTime() < Date.now();
};

const buildStatusCounts = (conferences: ConferenceDocument[]): Record<string, number> => {
  const counts: Record<string, number> = {};

  for (const conference of conferences) {
    const key = normalizeConferenceStatus(conference.status);
    counts[key] = (counts[key] || 0) + 1;
  }

  return counts;
};

export default defineEventHandler(async (event): Promise<ConferenceListResponse> => {
  await assertEventsAdminSession(event, ["admin", "curator"]);
  const databaseName = await ensureEventsDatabase();
  const query = getQuery(event);

  const search = normalize(query.search);
  const statusFilterRaw = String(query.status ?? "").trim();
  const statusFilter = normalize(statusFilterRaw);
  const continentFilter = normalize(query.continent);
  const publishedFilter = normalize(query.published);
  const includePast = parseBoolean(query.includePast, false);
  const yearFilter = parseYearFilter(query.year);

  const page = parsePositiveInt(query.page, 1, 10_000);
  const pageSize = parsePositiveInt(query.pageSize, 24, 200);

  const view = await getView(databaseName, "conferences", "by_start_date", {
    include_docs: true,
    descending: false,
  });

  const baseConferences = (view?.rows ?? [])
    .map((row) => row.doc as ConferenceDocument | undefined)
    .filter(
      (doc): doc is ConferenceDocument =>
        Boolean(doc && doc.type === "conference" && doc._id),
    );

  const normalizedBaseConferences = baseConferences.map((conference) => ({
    ...conference,
    status: normalizeConferenceStatus(conference.status),
  }));

  const allConferences = normalizedBaseConferences
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
      return (
        normalizeConferenceStatus(doc.status) ===
        normalizeConferenceStatus(statusFilterRaw)
      );
    })
    .filter((doc) => {
      if (!yearFilter) return true;
      if (yearFilter === "tba") {
        return !String(doc.startDateIso ?? "").trim().length;
      }
      return doc.year === yearFilter;
    })
    .filter((doc) => {
      if (!publishedFilter || publishedFilter === "all") return true;
      if (publishedFilter === "published") return doc.isPublished === true;
      if (publishedFilter === "draft") return doc.isPublished !== true;
      return true;
    })
    .filter((doc) => {
      if (includePast) return true;
      return !isPastConference(doc);
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
      normalizedBaseConferences
        .map((conference) => conference.year)
        .filter((year): year is number => typeof year === "number"),
    ),
  ).sort((left, right) => right - left);

  const continentOptions = uniqueTextOptions(
    normalizedBaseConferences.map((conference) => conference.continent),
  );

  return {
    conferences: paginatedConferences,
    total,
    page,
    pageSize,
    totalPages,
    unfilteredCounts: {
      total: normalizedBaseConferences.length,
      inProgress: normalizedBaseConferences.filter(
        (conference) => normalizeConferenceStatus(conference.status) === CONFERENCE_STATUS_IN_PROGRESS,
      ).length,
      published: normalizedBaseConferences.filter((conference) => conference.isPublished).length,
      draft: normalizedBaseConferences.filter((conference) => !conference.isPublished).length,
    },
    statusCounts: buildStatusCounts(conferences),
    publicationCounts: {
      published: conferences.filter((conference) => conference.isPublished).length,
      draft: conferences.filter((conference) => !conference.isPublished).length,
    },
    yearOptions,
    continentOptions,
  };
});
