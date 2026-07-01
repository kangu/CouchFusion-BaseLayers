/** Builder option for a font family allowlist entry. */
export interface ContentFontFamilyOption {
  slug: string;
  label: string;
}

/** Bunny catalog entry normalized for the admin font browser. */
export interface BunnyFontCatalogEntry {
  slug: string;
  label: string;
  category: string | null;
  defSubset: string | null;
  isVariable: boolean;
  styles: Array<"normal" | "italic">;
  weights: number[];
  variants: Record<string, number>;
}

/** Installed font metadata returned after a Bunny font is downloaded. */
export interface ContentInstalledFontFamily {
  slug: string;
  label: string;
  category?: string | null;
  installedAt: string;
  installedBy: string | null;
  styles: Array<"normal" | "italic">;
  weights: number[];
  widths: string[];
  attachmentNames: string[];
}

/**
 * Client-side shape of the canonical `content-settings:fonts` document.
 *
 * @remarks
 * Mirrors server model but keeps optional fields tolerant during rollout.
 */
export interface ContentFontSettingsDocument {
  _id: "content-settings:fonts";
  _rev?: string;
  type: "content-font-settings";
  sansFamily: string;
  displayFamily: string;
  profile: "minimal";
  styles: Array<"normal" | "italic">;
  weights: number[];
  widths: string[];
  status: "idle" | "applied" | "failed";
  lastApplyError: string | null;
  lastAppliedAt: string | null;
  lastAppliedBy: string | null;
  runtimeCssVersion: number;
  runtimeCssPath: string;
  runtimeCssText?: string | null;
  runtimeAssetMode?: "attachment";
  updatedAt: string;
  updatedBy: string | null;
}

/** API envelope returned by font settings/apply endpoints. */
type ContentFontSettingsResponse = {
  success?: boolean;
  allowlist?: ContentFontFamilyOption[];
  section?: string;
  settings?: ContentFontSettingsDocument;
  installedFamily?: ContentInstalledFontFamily;
};

type ContentFontCatalogResponse = {
  success?: boolean;
  fonts?: BunnyFontCatalogEntry[];
};

/** Runtime guard that validates incoming settings payload shape before state sync. */
const toSettings = (value: unknown): ContentFontSettingsDocument | null => {
  if (!value || typeof value !== "object") {
    return null;
  }
  const source = value as Record<string, any>;
  if (source._id !== "content-settings:fonts") {
    return null;
  }
  if (
    typeof source.sansFamily !== "string" ||
    typeof source.displayFamily !== "string" ||
    !Array.isArray(source.styles) ||
    !Array.isArray(source.weights) ||
    !Array.isArray(source.widths)
  ) {
    return null;
  }

  return source as ContentFontSettingsDocument;
};

/**
 * Admin composable for content-layer font configuration.
 *
 * @remarks
 * Keeps all builder-facing state in one place:
 * - settings/allowlist metadata,
 * - loading/applying/error flags,
 * - reactive runtimeCssVersion used by runtime head plugin for cache-busting.
 */
export const useContentFontSettings = () => {
  const settings = useState<ContentFontSettingsDocument | null>(
    "content-font-settings-doc",
    () => null,
  );
  const options = useState<ContentFontFamilyOption[]>(
    "content-font-settings-options",
    () => [],
  );
  const section = useState<string | null>("content-font-settings-section", () => null);
  const loading = useState<boolean>("content-font-settings-loading", () => false);
  const error = useState<string | null>("content-font-settings-error", () => null);
  const applying = useState<boolean>("content-font-settings-applying", () => false);
  const catalog = useState<BunnyFontCatalogEntry[]>(
    "content-font-catalog",
    () => [],
  );
  const catalogLoading = useState<boolean>("content-font-catalog-loading", () => false);
  const runtimeCssVersion = useState<number>(
    "content-font-runtime-css-version",
    () => Date.now(),
  );

  /** Normalize successful API response into local reactive state buckets. */
  const syncFromResponse = (response: ContentFontSettingsResponse | null | undefined) => {
    if (!response || response.success !== true) {
      return;
    }

    const normalizedSettings = toSettings(response.settings);
    if (normalizedSettings) {
      settings.value = normalizedSettings;
      runtimeCssVersion.value =
        normalizedSettings.runtimeCssVersion || Date.now();
    }

    options.value = Array.isArray(response.allowlist)
      ? response.allowlist
      : [];
    section.value =
      typeof response.section === "string" && response.section.trim()
        ? response.section
        : null;
  };

  /** Fetch current settings for admin UI initialization. */
  const fetchAdmin = async () => {
    loading.value = true;
    error.value = null;

    try {
      const response = await $fetch<ContentFontSettingsResponse>(
        "/api/content/fonts/settings",
      );
      syncFromResponse(response);
      return settings.value;
    } catch (requestError: any) {
      error.value =
        requestError?.data?.statusMessage ||
        requestError?.message ||
        "Failed to load font settings.";
      throw requestError;
    } finally {
      loading.value = false;
    }
  };

  /** Persist staged profile edits (without triggering binary apply). */
  const saveAdmin = async (payload: {
    sansFamily: string;
    displayFamily: string;
    styles: Array<"normal" | "italic">;
    weights: number[];
    widths: string[];
  }) => {
    loading.value = true;
    error.value = null;

    try {
      const response = await $fetch<ContentFontSettingsResponse>(
        "/api/content/fonts/settings",
        {
          method: "PUT",
          body: payload,
        },
      );
      syncFromResponse(response);
      return settings.value;
    } catch (requestError: any) {
      error.value =
        requestError?.data?.statusMessage ||
        requestError?.message ||
        "Failed to save font settings.";
      throw requestError;
    } finally {
      loading.value = false;
    }
  };

  /** Execute apply pipeline and refresh local version marker for runtime stylesheet invalidation. */
  const applyAdmin = async () => {
    applying.value = true;
    error.value = null;
    try {
      const response = await $fetch<ContentFontSettingsResponse>(
        "/api/content/fonts/apply",
        { method: "POST" },
      );
      syncFromResponse(response);
      runtimeCssVersion.value = Date.now();
      return settings.value;
    } catch (requestError: any) {
      error.value =
        requestError?.data?.statusMessage ||
        requestError?.message ||
        "Failed to apply font settings.";
      throw requestError;
    } finally {
      applying.value = false;
    }
  };

  /** Fetch the available Bunny font catalog for the add-font dialog. */
  const fetchCatalog = async () => {
    catalogLoading.value = true;
    error.value = null;

    try {
      const response = await $fetch<ContentFontCatalogResponse>(
        "/api/content/fonts/catalog",
      );
      catalog.value = response?.success === true && Array.isArray(response.fonts)
        ? response.fonts
        : [];
      return catalog.value;
    } catch (requestError: any) {
      error.value =
        requestError?.data?.statusMessage ||
        requestError?.message ||
        "Failed to load Bunny font catalog.";
      throw requestError;
    } finally {
      catalogLoading.value = false;
    }
  };

  /** Install one Bunny family using the current editor typography profile. */
  const installFamily = async (payload: {
    family: string;
    styles: Array<"normal" | "italic">;
    weights: number[];
    widths: string[];
  }) => {
    applying.value = true;
    error.value = null;

    try {
      const response = await $fetch<ContentFontSettingsResponse>(
        "/api/content/fonts/install",
        {
          method: "POST",
          body: payload,
        },
      );
      syncFromResponse(response);
      return response?.installedFamily ?? null;
    } catch (requestError: any) {
      error.value =
        requestError?.data?.statusMessage ||
        requestError?.message ||
        "Failed to install Bunny font.";
      throw requestError;
    } finally {
      applying.value = false;
    }
  };

  /** Manual stylesheet version bump helper used by builder workflows. */
  const bumpRuntimeStylesheet = () => {
    runtimeCssVersion.value = Date.now();
  };

  return {
    settings,
    options,
    section,
    loading,
    applying,
    catalog,
    catalogLoading,
    error,
    runtimeCssVersion,
    fetchAdmin,
    saveAdmin,
    applyAdmin,
    fetchCatalog,
    installFamily,
    bumpRuntimeStylesheet,
  };
};
