export const CONTENT_GLOBAL_COMPONENTS_DOC_ID =
  "content-settings:global-components";

export interface ContentGlobalComponentEntry {
  id: string;
  component: string;
  enabled: boolean;
  defaultProps: Record<string, unknown>;
  defaultPropsByLocale?: Record<string, Record<string, unknown>>;
  updatedAt?: string;
  updatedBy?: string | null;
}

const GLOBAL_COMPONENT_ID_PATTERN = /^[A-Za-z][A-Za-z0-9_-]*$/;

const asRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
};

const asRecordOfRecords = (
  value: unknown,
): Record<string, Record<string, unknown>> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const result: Record<string, Record<string, unknown>> = {};
  for (const [locale, candidate] of Object.entries(
    value as Record<string, unknown>,
  )) {
    const trimmedLocale = locale.trim();
    if (!trimmedLocale.length) {
      continue;
    }
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      continue;
    }
    result[trimmedLocale] = candidate as Record<string, unknown>;
  }

  return result;
};

export const normalizeGlobalComponentId = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed.length) {
    return null;
  }
  if (!GLOBAL_COMPONENT_ID_PATTERN.test(trimmed)) {
    return null;
  }
  return trimmed;
};

export const normalizeGlobalComponentEntry = (
  value: unknown,
): ContentGlobalComponentEntry | null => {
  const candidate = asRecord(value);
  const id = normalizeGlobalComponentId(candidate.id);
  const component = normalizeGlobalComponentId(candidate.component);
  if (!id || !component) {
    return null;
  }

  return {
    id,
    component,
    enabled: candidate.enabled !== false,
    defaultProps: asRecord(candidate.defaultProps),
    defaultPropsByLocale: asRecordOfRecords(candidate.defaultPropsByLocale),
    updatedAt:
      typeof candidate.updatedAt === "string" ? candidate.updatedAt : undefined,
    updatedBy:
      typeof candidate.updatedBy === "string" ? candidate.updatedBy : null,
  };
};

export const normalizeGlobalComponentEntries = (
  value: unknown,
): ContentGlobalComponentEntry[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const byId = new Map<string, ContentGlobalComponentEntry>();
  for (const entry of value) {
    const normalized = normalizeGlobalComponentEntry(entry);
    if (!normalized) {
      continue;
    }
    byId.set(normalized.id, normalized);
  }

  return Array.from(byId.values()).sort((a, b) => a.id.localeCompare(b.id));
};
