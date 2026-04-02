import { getAllDocs, getDocument, putDocument } from "#database/utils/couchdb";
import type { ConferenceDocument } from "./conference-csv";
import { normalizeConferenceStatus } from "./conference-status";
import { ensureEventsDatabase } from "./events-db";

interface RecreateOptions {
  nowIso?: string;
}

export interface RecreateConferencesNextYearStats {
  scannedConferences: number;
  eligibleConferences: number;
  createdConferences: number;
  skippedMissingStartDate: number;
  skippedInvalidStartDate: number;
  skippedDisabled: number;
  skippedWrongMonth: number;
  skippedDuplicate: number;
}

const CONFERENCE_ID_PREFIX = "conference:";
const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const pad2 = (value: number): string => String(value).padStart(2, "0");

const parseIsoDateOnly = (value: string): Date | null => {
  const match = DATE_ONLY_PATTERN.exec(value);
  if (!match) return null;

  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
};

const parseStartDate = (value: string): { date: Date; isDateOnly: boolean } | null => {
  const normalized = value.trim();
  if (!normalized.length) return null;

  const dateOnly = parseIsoDateOnly(normalized);
  if (dateOnly) {
    return { date: dateOnly, isDateOnly: true };
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return { date: parsed, isDateOnly: false };
};

const toDateOnlyIso = (date: Date): string =>
  `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;

const shiftOneUtcYear = (value: string): string | null => {
  const parsed = parseStartDate(value);
  if (!parsed) return null;

  const shifted = new Date(parsed.date.getTime());
  shifted.setUTCFullYear(shifted.getUTCFullYear() + 1);

  if (parsed.isDateOnly) {
    return toDateOnlyIso(shifted);
  }

  return shifted.toISOString();
};

const isInPreviousUtcMonth = (value: string, now: Date): boolean => {
  const parsed = parseStartDate(value);
  if (!parsed) return false;

  const currentMonthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0),
  );
  const previousMonthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1, 0, 0, 0, 0),
  );

  return (
    parsed.date.getTime() >= previousMonthStart.getTime() &&
    parsed.date.getTime() < currentMonthStart.getTime()
  );
};

const withYearSuffix = (slug: string, targetYear: number): string => {
  const normalizedSlug = slug.trim().toLowerCase();
  if (!normalizedSlug.length) {
    return String(targetYear);
  }

  const withoutTrailingYear = normalizedSlug.replace(/-\d{4}$/, "");
  return `${withoutTrailingYear}-${targetYear}`;
};

const deriveNextDocumentId = (source: ConferenceDocument, nextStartDateIso: string): string => {
  const parsed = parseStartDate(nextStartDateIso);
  const nextYear = parsed?.date.getUTCFullYear();

  if (!nextYear || !Number.isFinite(nextYear)) {
    throw new Error(`Unable to derive conference year for ${source._id}`);
  }

  const nextSlug = withYearSuffix(String(source.slug ?? ""), nextYear);
  return `${CONFERENCE_ID_PREFIX}${nextYear}:${nextSlug}`;
};

/**
 * Recreate previous-month conferences that have next-year recreation enabled.
 */
export const recreateConferencesForNextYear = async (
  options: RecreateOptions = {},
): Promise<RecreateConferencesNextYearStats> => {
  const now = options.nowIso ? new Date(options.nowIso) : new Date();
  if (Number.isNaN(now.getTime())) {
    throw new Error("Invalid nowIso value");
  }

  const databaseName = await ensureEventsDatabase();
  const allDocs = await getAllDocs(databaseName, {
    startkey: CONFERENCE_ID_PREFIX,
    endkey: `${CONFERENCE_ID_PREFIX}\ufff0`,
    include_docs: true,
  });

  const stats: RecreateConferencesNextYearStats = {
    scannedConferences: 0,
    eligibleConferences: 0,
    createdConferences: 0,
    skippedMissingStartDate: 0,
    skippedInvalidStartDate: 0,
    skippedDisabled: 0,
    skippedWrongMonth: 0,
    skippedDuplicate: 0,
  };

  const conferences = (allDocs?.rows ?? [])
    .map((row) => row.doc as ConferenceDocument | undefined)
    .filter(
      (doc): doc is ConferenceDocument =>
        Boolean(doc && doc.type === "conference" && typeof doc._id === "string"),
    );

  for (const conference of conferences) {
    stats.scannedConferences += 1;

    if (!conference.recreateNextYear) {
      stats.skippedDisabled += 1;
      continue;
    }

    const sourceStartDateIso = String(conference.startDateIso ?? "").trim();
    if (!sourceStartDateIso.length) {
      stats.skippedMissingStartDate += 1;
      continue;
    }

    const parsedStartDate = parseStartDate(sourceStartDateIso);
    if (!parsedStartDate) {
      stats.skippedInvalidStartDate += 1;
      continue;
    }

    if (!isInPreviousUtcMonth(sourceStartDateIso, now)) {
      stats.skippedWrongMonth += 1;
      continue;
    }

    stats.eligibleConferences += 1;

    const nextStartDateIso = shiftOneUtcYear(sourceStartDateIso);
    if (!nextStartDateIso) {
      stats.skippedInvalidStartDate += 1;
      continue;
    }

    const nextDocumentId = deriveNextDocumentId(conference, nextStartDateIso);
    const existingNextYearConference = await getDocument<ConferenceDocument>(
      databaseName,
      nextDocumentId,
    );

    if (existingNextYearConference) {
      stats.skippedDuplicate += 1;
      continue;
    }

    const nowIso = now.toISOString();
    const nextStartYear = parseStartDate(nextStartDateIso)?.date.getUTCFullYear() ?? null;

    const nextConference: ConferenceDocument = {
      ...conference,
      _id: nextDocumentId,
      _rev: undefined,
      year: nextStartYear,
      slug: nextDocumentId.split(":").slice(2).join(":"),
      startDateIso: nextStartDateIso,
      monthLabel: conference.monthLabel,
      dateRangeLabel: conference.dateRangeLabel,
      isPublished: false,
      status: normalizeConferenceStatus(null),
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const { _rev: _ignoredRev, ...documentToPersist } = nextConference;
    await putDocument(databaseName, documentToPersist);
    stats.createdConferences += 1;
  }

  return stats;
};
