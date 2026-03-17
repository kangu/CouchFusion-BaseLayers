export interface UserConferencePreferences {
  favorites: string[];
  watched: string[];
}

const normalizeList = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0),
    ),
  );
};

export const normalizeConferencePreferences = (
  value: unknown,
): UserConferencePreferences => {
  const record =
    value && typeof value === "object" ? (value as Record<string, unknown>) : {};

  return {
    favorites: normalizeList(record.favorites),
    watched: normalizeList(record.watched),
  };
};

export const setConferencePreference = (
  prefs: UserConferencePreferences,
  listKey: keyof UserConferencePreferences,
  conferenceId: string,
  enabled: boolean,
): UserConferencePreferences => {
  const nextSet = new Set(prefs[listKey]);

  if (enabled) {
    nextSet.add(conferenceId);
  } else {
    nextSet.delete(conferenceId);
  }

  return {
    ...prefs,
    [listKey]: Array.from(nextSet),
  };
};
