export type ConferencesSortDirection = "asc" | "desc";

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const toTimestamp = (value: string | null | undefined): number | null => {
  const raw = String(value ?? "").trim();
  if (!raw.length) return null;

  const dateOnlyMatch = DATE_ONLY_PATTERN.exec(raw);
  if (dateOnlyMatch) {
    const year = Number.parseInt(dateOnlyMatch[1], 10);
    const month = Number.parseInt(dateOnlyMatch[2], 10);
    const day = Number.parseInt(dateOnlyMatch[3], 10);
    return Date.UTC(year, month - 1, day);
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.getTime();
};

export const compareConferenceYearByComputedDate = (
  leftStartDateIso: string | null | undefined,
  rightStartDateIso: string | null | undefined,
  direction: ConferencesSortDirection,
): number => {
  const leftTimestamp = toTimestamp(leftStartDateIso);
  const rightTimestamp = toTimestamp(rightStartDateIso);
  const isDescending = direction === "desc";

  if (leftTimestamp === null && rightTimestamp === null) return 0;
  if (leftTimestamp === null) return isDescending ? -1 : 1;
  if (rightTimestamp === null) return isDescending ? 1 : -1;

  const delta = leftTimestamp - rightTimestamp;
  if (delta === 0) return 0;
  return isDescending ? -delta : delta;
};
