export const CONFERENCE_STATUS_TO_BE_CONTACTED = "To be Contacted";
export const CONFERENCE_STATUS_IN_PROGRESS = "In progress";
export const CONFERENCE_STATUS_DONE_CONFIRMED = "Done (confirmed)";
export const CONFERENCE_STATUS_DECLINED = "Declined";

export const CONFERENCE_STATUS_OPTIONS = [
  CONFERENCE_STATUS_TO_BE_CONTACTED,
  CONFERENCE_STATUS_IN_PROGRESS,
  CONFERENCE_STATUS_DONE_CONFIRMED,
  CONFERENCE_STATUS_DECLINED,
] as const;

const normalize = (value: unknown): string =>
  String(value ?? "").trim().toLowerCase();

export const normalizeConferenceStatus = (value: unknown): string => {
  const normalized = normalize(value);

  if (!normalized.length) {
    return CONFERENCE_STATUS_TO_BE_CONTACTED;
  }

  if (
    normalized === "to be contacted" ||
    normalized === "to be contact" ||
    normalized === "not started" ||
    normalized === "blocked" ||
    normalized === "archived"
  ) {
    return CONFERENCE_STATUS_TO_BE_CONTACTED;
  }

  if (normalized === "in progress") {
    return CONFERENCE_STATUS_IN_PROGRESS;
  }

  if (
    normalized === "done (confirmed)" ||
    normalized === "done" ||
    normalized === "completed"
  ) {
    return CONFERENCE_STATUS_DONE_CONFIRMED;
  }

  if (normalized === "declined") {
    return CONFERENCE_STATUS_DECLINED;
  }

  return CONFERENCE_STATUS_TO_BE_CONTACTED;
};
