import type { ContentGlobalComponentEntry } from "#content/utils/global-components";

type GlobalComponentsPublicResponse = {
  success?: boolean;
  components?: unknown;
};

type GlobalComponentsAdminResponse = {
  success?: boolean;
  settings?: {
    entries?: unknown;
    updatedAt?: string | null;
    updatedBy?: string | null;
  };
};

const normalizeEntry = (value: unknown): ContentGlobalComponentEntry | null => {
  if (!value || typeof value !== "object") {
    return null;
  }
  const raw = value as Record<string, any>;
  const id = typeof raw.id === "string" ? raw.id.trim() : "";
  const component = typeof raw.component === "string" ? raw.component.trim() : "";
  if (!id || !component) {
    return null;
  }
  const defaultProps =
    raw.defaultProps && typeof raw.defaultProps === "object" && !Array.isArray(raw.defaultProps)
      ? (raw.defaultProps as Record<string, unknown>)
      : {};
  const defaultPropsByLocale =
    raw.defaultPropsByLocale &&
    typeof raw.defaultPropsByLocale === "object" &&
    !Array.isArray(raw.defaultPropsByLocale)
      ? Object.fromEntries(
          Object.entries(raw.defaultPropsByLocale as Record<string, unknown>).filter(
            ([locale, value]) =>
              typeof locale === "string" &&
              locale.trim().length > 0 &&
              Boolean(value) &&
              typeof value === "object" &&
              !Array.isArray(value),
          ),
        ) as Record<string, Record<string, unknown>>
      : {};

  return {
    id,
    component,
    enabled: raw.enabled !== false,
    defaultProps,
    defaultPropsByLocale,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : undefined,
    updatedBy: typeof raw.updatedBy === "string" ? raw.updatedBy : null,
  };
};

const normalizeEntries = (value: unknown): ContentGlobalComponentEntry[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  const dedup = new Map<string, ContentGlobalComponentEntry>();
  for (const item of value) {
    const normalized = normalizeEntry(item);
    if (!normalized) {
      continue;
    }
    dedup.set(normalized.id, normalized);
  }
  return Array.from(dedup.values()).sort((a, b) => a.id.localeCompare(b.id));
};

export const useGlobalComponentsRegistry = () => {
  const components = useState<ContentGlobalComponentEntry[]>(
    "content-global-components",
    () => [],
  );
  const loading = useState<boolean>("content-global-components-loading", () => false);
  const error = useState<string | null>("content-global-components-error", () => null);
  const updatedAt = useState<string | null>("content-global-components-updated-at", () => null);
  const updatedBy = useState<string | null>("content-global-components-updated-by", () => null);

  const fetchPublic = async () => {
    loading.value = true;
    error.value = null;
    try {
      const response = await $fetch<GlobalComponentsPublicResponse>(
        "/api/content/global-components",
      );
      components.value = normalizeEntries(response?.components);
    } catch (err: any) {
      error.value =
        err?.data?.statusMessage ||
        err?.message ||
        "Failed to load global components.";
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const fetchAdmin = async () => {
    loading.value = true;
    error.value = null;
    try {
      const response = await $fetch<GlobalComponentsAdminResponse>(
        "/api/content/global-components/admin",
      );
      components.value = normalizeEntries(response?.settings?.entries);
      updatedAt.value =
        typeof response?.settings?.updatedAt === "string"
          ? response.settings.updatedAt
          : null;
      updatedBy.value =
        typeof response?.settings?.updatedBy === "string"
          ? response.settings.updatedBy
          : null;
    } catch (err: any) {
      error.value =
        err?.data?.statusMessage ||
        err?.message ||
        "Failed to load global component settings.";
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const saveAdmin = async (entries: unknown) => {
    loading.value = true;
    error.value = null;
    try {
      const response = await $fetch<GlobalComponentsAdminResponse>(
        "/api/content/global-components/admin",
        {
          method: "PUT",
          body: { entries },
        },
      );
      components.value = normalizeEntries(response?.settings?.entries);
      updatedAt.value =
        typeof response?.settings?.updatedAt === "string"
          ? response.settings.updatedAt
          : null;
      updatedBy.value =
        typeof response?.settings?.updatedBy === "string"
          ? response.settings.updatedBy
          : null;
      return components.value;
    } catch (err: any) {
      error.value =
        err?.data?.statusMessage ||
        err?.message ||
        "Failed to save global component settings.";
      throw err;
    } finally {
      loading.value = false;
    }
  };

  return {
    components,
    loading,
    error,
    updatedAt,
    updatedBy,
    fetchPublic,
    fetchAdmin,
    saveAdmin,
  };
};
