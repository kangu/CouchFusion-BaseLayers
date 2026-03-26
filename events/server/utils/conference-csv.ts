import type { CouchDBDocument } from "#database/utils/couchdb";
import { normalizeConferenceStatus } from "./conference-status";

const BOOLEAN_TRUE_TOKENS = new Set([
  "1",
  "true",
  "yes",
  "y",
  "ok",
  "x",
  "✅",
]);

const BOOLEAN_FALSE_TOKENS = new Set(["0", "false", "no", "n", "❌"]);

export interface ConferenceDocument extends CouchDBDocument {
  _id: string;
  _rev?: string;
  type: "conference";
  name: string;
  slug: string;
  year: number | null;
  websiteUrl: string | null;
  xAccountUrl: string | null;
  location: string | null;
  city: string | null;
  monthLabel: string | null;
  startDateIso: string | null;
  dateRangeLabel: string | null;
  country: string | null;
  continent: string | null;
  hasAirtable: boolean;
  isPublished: boolean;
  recreateNextYear: boolean;
  discountCode: string | null;
  discountLabel: string | null;
  commissionLabel: string | null;
  ticketsSold: number | null;
  commissionEarnedLabel: string | null;
  commissionReceived: boolean | null;
  contactName: string | null;
  contactChannel: string | null;
  bitvocationParticipation: "yes" | "no" | "unknown";
  status: string;
  notes: string | null;
  ownerTodo: string | null;
  source: {
    format: "csv-semicolon";
    rowNumber: number;
    importedAt: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface ParsedConferenceCsv {
  conferences: ConferenceDocument[];
  warnings: string[];
  meta: {
    rowCount: number;
    validConferenceCount: number;
    ignoredRowCount: number;
  };
}

const normalizeText = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

const maybeText = (value: unknown): string | null => {
  const normalized = normalizeText(value);
  return normalized.length ? normalized : null;
};

const toBool = (value: unknown): boolean => {
  const normalized = normalizeText(value).toLowerCase();
  if (!normalized) return false;
  if (BOOLEAN_TRUE_TOKENS.has(normalized)) return true;
  return false;
};

const toOptionalBool = (value: unknown): boolean | null => {
  const normalized = normalizeText(value).toLowerCase();
  if (!normalized) return null;
  if (BOOLEAN_TRUE_TOKENS.has(normalized)) return true;
  if (BOOLEAN_FALSE_TOKENS.has(normalized)) return false;
  return null;
};

const toNumber = (value: unknown): number | null => {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  const parsed = Number.parseInt(normalized.replace(/[^\d-]/g, ""), 10);
  return Number.isFinite(parsed) ? parsed : null;
};

const toSlug = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const pad2 = (value: number): string => String(value).padStart(2, "0");

const isValidDateParts = (
  year: number,
  month: number,
  day: number,
): boolean => {
  const probe = new Date(Date.UTC(year, month - 1, day));
  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day
  );
};

const parseIsoDateOnly = (value: string): string | null => {
  const match = DATE_ONLY_PATTERN.exec(value);
  if (!match) return null;

  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);

  if (!isValidDateParts(year, month, day)) return null;
  return `${year}-${pad2(month)}-${pad2(day)}`;
};

const parseStartDate = (value: string): string | null => {
  const normalized = normalizeText(value);
  if (!normalized) return null;

  const explicitDateOnly = parseIsoDateOnly(normalized);
  if (explicitDateOnly) {
    return explicitDateOnly;
  }

  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  // Preserve the calendar date the operator entered, without UTC conversion drift.
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
};

const parseParticipation = (value: unknown): "yes" | "no" | "unknown" => {
  const normalized = normalizeText(value).toLowerCase();
  if (!normalized) return "unknown";
  if (BOOLEAN_FALSE_TOKENS.has(normalized)) return "no";
  if (BOOLEAN_TRUE_TOKENS.has(normalized)) return "yes";
  return "unknown";
};

/**
 * Derive a city value from flexible source columns when explicit city is missing.
 */
const deriveCity = (cityInput: unknown, locationInput: unknown): string | null => {
  const explicitCity = maybeText(cityInput);
  if (explicitCity) {
    return explicitCity;
  }

  const location = maybeText(locationInput);
  if (!location) return null;

  const normalized = location.toLowerCase();
  if (normalized === "online") return null;

  if (location.includes(" - ")) {
    const [, afterDash] = location.split(" - ", 2);
    const candidate = maybeText(afterDash);
    if (candidate && candidate.toLowerCase() !== "online") return candidate;
  }

  if (location.includes(",")) {
    const [beforeComma] = location.split(",", 1);
    const candidate = maybeText(beforeComma);
    if (candidate && candidate.toLowerCase() !== "online") return candidate;
  }

  return null;
};

const splitSemicolonLine = (line: string): string[] => {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === "\"") {
      const nextChar = line[index + 1];
      if (inQuotes && nextChar === "\"") {
        current += "\"";
        index += 1;
        continue;
      }

      inQuotes = !inQuotes;
      continue;
    }

    if (char === ";" && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
};

const parseHeaderMap = (headerLine: string): Map<string, number> => {
  const map = new Map<string, number>();
  const columns = splitSemicolonLine(headerLine);

  columns.forEach((column, index) => {
    const normalizedColumn = normalizeText(column);
    if (normalizedColumn) {
      map.set(normalizedColumn, index);
    }
  });

  return map;
};

const getField = (
  row: string[],
  headers: Map<string, number>,
  fieldName: string,
): string => {
  const index = headers.get(fieldName);
  if (typeof index !== "number") return "";
  return row[index] ?? "";
};

export const parseConferenceCsv = (csvText: string): ParsedConferenceCsv => {
  const warnings: string[] = [];
  const importedAt = new Date().toISOString();
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.replace(/\uFEFF/g, ""))
    .filter((line) => line.trim().length > 0);

  if (!lines.length) {
    return {
      conferences: [],
      warnings: ["CSV content is empty."],
      meta: {
        rowCount: 0,
        validConferenceCount: 0,
        ignoredRowCount: 0,
      },
    };
  }

  const headers = parseHeaderMap(lines[0]);
  const conferences: ConferenceDocument[] = [];
  let ignoredRowCount = 0;

  for (let rowIndex = 1; rowIndex < lines.length; rowIndex += 1) {
    const rowLine = lines[rowIndex];
    const row = splitSemicolonLine(rowLine);
    const name = normalizeText(getField(row, headers, "Conference Name"));

    if (!name) {
      ignoredRowCount += 1;
      continue;
    }

    const year = toNumber(getField(row, headers, "Year"));
    const startDateLabel = normalizeText(getField(row, headers, "Start Date"));
    const startDateIso = parseStartDate(startDateLabel);
    if (startDateLabel && !startDateIso) {
      warnings.push(
        `Row ${rowIndex + 1} (${name}): invalid Start Date "${startDateLabel}".`,
      );
    }

    const airtableRaw = getField(row, headers, "Airtable?");
    const hasAirtable = toBool(airtableRaw);

    const docId = [
      "conference",
      year ?? "unknown-year",
      toSlug(name) || `row-${rowIndex + 1}`,
    ].join(":");

    const now = importedAt;
    const conference: ConferenceDocument = {
      _id: docId,
      type: "conference",
      name,
      slug: toSlug(name),
      year,
      websiteUrl: maybeText(getField(row, headers, "URL")),
      xAccountUrl: maybeText(getField(row, headers, "X Account")),
      location: maybeText(getField(row, headers, "Location")),
      city: deriveCity(getField(row, headers, "City"), getField(row, headers, "Location")),
      monthLabel: maybeText(getField(row, headers, "Month")),
      startDateIso,
      dateRangeLabel: maybeText(getField(row, headers, "Date")),
      country: maybeText(getField(row, headers, "Country")),
      continent: maybeText(getField(row, headers, "Continent")),
      hasAirtable,
      isPublished: false,
      recreateNextYear: false,
      discountCode: maybeText(getField(row, headers, "Discount Code?")),
      discountLabel: maybeText(getField(row, headers, "Discount")),
      commissionLabel: maybeText(getField(row, headers, "Our commission")),
      ticketsSold: toNumber(getField(row, headers, "Tickets sold")),
      commissionEarnedLabel: maybeText(
        getField(row, headers, "Commission earned"),
      ),
      commissionReceived: toOptionalBool(
        getField(row, headers, "Commission received?"),
      ),
      contactName: maybeText(getField(row, headers, "Conference Contact Name")),
      contactChannel: maybeText(
        getField(row, headers, "Contact email / form url"),
      ),
      bitvocationParticipation: parseParticipation(
        getField(row, headers, "Bitvocation Participation"),
      ),
      status: normalizeConferenceStatus(maybeText(getField(row, headers, "Status"))),
      notes: maybeText(getField(row, headers, "Notes")),
      ownerTodo: maybeText(getField(row, headers, "Anja to do")),
      source: {
        format: "csv-semicolon",
        rowNumber: rowIndex + 1,
        importedAt,
      },
      createdAt: now,
      updatedAt: now,
    };

    conferences.push(conference);
  }

  return {
    conferences,
    warnings,
    meta: {
      rowCount: lines.length - 1,
      validConferenceCount: conferences.length,
      ignoredRowCount,
    },
  };
};
