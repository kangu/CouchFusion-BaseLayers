export interface EmployeeDisplaySource {
  name?: unknown;
  full_name?: unknown;
  profile?: Record<string, unknown> | null;
}

const asTrimmedString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const readEmployeeFullName = (
  source: EmployeeDisplaySource | null | undefined,
): string | null => {
  if (!source || typeof source !== "object") {
    return null;
  }

  const profile = source.profile;
  if (profile && typeof profile === "object") {
    const profileFullName = asTrimmedString(profile.full_name ?? profile.fullName);
    if (profileFullName) {
      return profileFullName;
    }
  }

  return asTrimmedString(source.full_name);
};

export const getEmployeeDisplayLabel = (
  source: EmployeeDisplaySource | null | undefined,
  fallbackName?: string | null,
): string => {
  return readEmployeeFullName(source) ?? asTrimmedString(fallbackName) ?? "";
};
