import { getDocument } from "#database/utils/couchdb";

export const FEATURED_CONFERENCES_DOCUMENT_ID = "events_featured_conferences";

export interface FeaturedConferenceEntry {
  conferenceId: string;
  enabled: boolean;
  imageUrl: string | null;
  imageFileId: string | null;
  imageAlt: string | null;
}

export interface FeaturedConferencesDocument {
  _id: typeof FEATURED_CONFERENCES_DOCUMENT_ID;
  _rev?: string;
  type: "events_featured_conferences";
  entries: FeaturedConferenceEntry[];
  createdAt: string;
  updatedAt: string;
}

const asTrimmedText = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const normalizeEntry = (value: unknown): FeaturedConferenceEntry | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const raw = value as Record<string, unknown>;
  const conferenceId = asTrimmedText(raw.conferenceId);
  if (!conferenceId) {
    return null;
  }

  return {
    conferenceId,
    enabled: raw.enabled !== false,
    imageUrl: asTrimmedText(raw.imageUrl),
    imageFileId: asTrimmedText(raw.imageFileId),
    imageAlt: asTrimmedText(raw.imageAlt),
  };
};

export const normalizeFeaturedEntries = (
  value: unknown,
): FeaturedConferenceEntry[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const seenConferenceIds = new Set<string>();
  const normalized: FeaturedConferenceEntry[] = [];

  for (const entry of value) {
    const normalizedEntry = normalizeEntry(entry);
    if (!normalizedEntry) {
      continue;
    }

    if (seenConferenceIds.has(normalizedEntry.conferenceId)) {
      continue;
    }

    seenConferenceIds.add(normalizedEntry.conferenceId);
    normalized.push(normalizedEntry);
  }

  return normalized;
};

export const getFeaturedConferencesDocument = async (
  databaseName: string,
): Promise<FeaturedConferencesDocument | null> => {
  const document = await getDocument<FeaturedConferencesDocument>(
    databaseName,
    FEATURED_CONFERENCES_DOCUMENT_ID,
  );

  if (!document || document.type !== "events_featured_conferences") {
    return null;
  }

  return {
    ...document,
    entries: normalizeFeaturedEntries(document.entries),
  };
};
