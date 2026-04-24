/** One token definition exposed by the content theme schema API. */
export interface ContentThemeTokenDefinition {
  key: string;
  label: string;
  namespace: string;
  valueType: "color" | "length" | "number" | "string";
  simpleEditable: boolean;
  runtimeWritable: boolean;
  owner: "theme" | "fonts";
  description: string;
}

/** One namespace definition exposed by the content theme schema API. */
export interface ContentThemeNamespaceDefinition {
  key: string;
  label: string;
  compileTimeOnly: boolean;
  description: string;
}

/** Full schema payload used by simple/full theme editors. */
export interface ContentThemeSchema {
  namespaces: ContentThemeNamespaceDefinition[];
  tokens: ContentThemeTokenDefinition[];
  simpleTokenKeys: string[];
  fullEditableTokenKeys: string[];
  readOnlyTokenKeys: string[];
}

/** Client-side shape of the canonical `content-settings:theme` document. */
export interface ContentThemeSettingsDocument {
  _id: "content-settings:theme";
  _rev?: string;
  type: "content-tailwind-settings";
  draftTokens: Record<string, string>;
  appliedTokens: Record<string, string>;
  runtimeCssVersion: number;
  status: "idle" | "applied" | "failed";
  lastApplyError: string | null;
  lastAppliedAt: string | null;
  lastAppliedBy: string | null;
  updatedAt: string;
  updatedBy: string | null;
}

type ContentThemeSettingsResponse = {
  success?: boolean;
  schema?: ContentThemeSchema;
  settings?: ContentThemeSettingsDocument;
};

const toSettings = (value: unknown): ContentThemeSettingsDocument | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const source = value as Record<string, any>;
  if (source._id !== "content-settings:theme") {
    return null;
  }

  if (
    !source.draftTokens ||
    typeof source.draftTokens !== "object" ||
    !source.appliedTokens ||
    typeof source.appliedTokens !== "object"
  ) {
    return null;
  }

  return source as ContentThemeSettingsDocument;
};

const toSchema = (value: unknown): ContentThemeSchema | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const source = value as Record<string, any>;
  if (!Array.isArray(source.namespaces) || !Array.isArray(source.tokens)) {
    return null;
  }

  return source as ContentThemeSchema;
};

/**
 * Admin composable for runtime Tailwind/theme settings.
 *
 * @remarks
 * Exposes schema + settings state plus save/apply actions for builder controls.
 */
export const useContentThemeSettings = () => {
  const settings = useState<ContentThemeSettingsDocument | null>(
    "content-theme-settings-doc",
    () => null,
  );
  const schema = useState<ContentThemeSchema | null>(
    "content-theme-settings-schema",
    () => null,
  );
  const loading = useState<boolean>("content-theme-settings-loading", () => false);
  const applying = useState<boolean>("content-theme-settings-applying", () => false);
  const error = useState<string | null>("content-theme-settings-error", () => null);
  const runtimeCssVersion = useState<number>(
    "content-theme-runtime-css-version",
    () => Date.now(),
  );

  const syncFromResponse = (response: ContentThemeSettingsResponse | null | undefined) => {
    if (!response || response.success !== true) {
      return;
    }

    const normalizedSettings = toSettings(response.settings);
    if (normalizedSettings) {
      settings.value = normalizedSettings;
      runtimeCssVersion.value = normalizedSettings.runtimeCssVersion || Date.now();
    }

    const normalizedSchema = toSchema(response.schema);
    if (normalizedSchema) {
      schema.value = normalizedSchema;
    }
  };

  const fetchAdmin = async () => {
    loading.value = true;
    error.value = null;
    try {
      const response = await $fetch<ContentThemeSettingsResponse>(
        "/api/content/theme/settings",
      );
      syncFromResponse(response);
      return settings.value;
    } catch (requestError: any) {
      error.value =
        requestError?.data?.statusMessage ||
        requestError?.message ||
        "Failed to load theme settings.";
      throw requestError;
    } finally {
      loading.value = false;
    }
  };

  const saveAdmin = async (payload: { draftTokens: Record<string, string> }) => {
    loading.value = true;
    error.value = null;
    try {
      const response = await $fetch<ContentThemeSettingsResponse>(
        "/api/content/theme/settings",
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
        "Failed to save theme settings.";
      throw requestError;
    } finally {
      loading.value = false;
    }
  };

  const applyAdmin = async () => {
    applying.value = true;
    error.value = null;
    try {
      const response = await $fetch<ContentThemeSettingsResponse>(
        "/api/content/theme/apply",
        {
          method: "POST",
        },
      );
      syncFromResponse(response);
      runtimeCssVersion.value = Date.now();
      return settings.value;
    } catch (requestError: any) {
      error.value =
        requestError?.data?.statusMessage ||
        requestError?.message ||
        "Failed to apply theme settings.";
      throw requestError;
    } finally {
      applying.value = false;
    }
  };

  const bumpRuntimeStylesheet = () => {
    runtimeCssVersion.value = Date.now();
  };

  return {
    settings,
    schema,
    loading,
    applying,
    error,
    runtimeCssVersion,
    fetchAdmin,
    saveAdmin,
    applyAdmin,
    bumpRuntimeStylesheet,
  };
};
