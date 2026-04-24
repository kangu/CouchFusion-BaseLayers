/** Normalized runtime styling feature flags consumed by app and server code. */
export interface ContentRuntimeStylingConfig {
  enabled: boolean;
  fontsEnabled: boolean;
  themeEnabled: boolean;
}

const toObject = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

const toOptionalBoolean = (value: unknown): boolean | null => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value !== 0 : null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  if (["1", "true", "yes", "on", "enabled"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off", "disabled"].includes(normalized)) {
    return false;
  }

  return null;
};

const resolveNestedFeatureFlag = (value: unknown, fallback: boolean): boolean => {
  const direct = toOptionalBoolean(value);
  if (direct !== null) {
    return direct;
  }

  const source = toObject(value);
  const nested = toOptionalBoolean(source.enabled);
  return nested ?? fallback;
};

/**
 * Resolve runtime styling flags from `runtimeConfig.content`.
 *
 * @remarks
 * Supported implementing-app config shape:
 *
 * ```ts
 * runtimeConfig: {
 *   content: {
 *     runtimeStyling: {
 *       enabled: true,
 *       fonts: { enabled: true },
 *       theme: { enabled: true },
 *     },
 *   },
 *   public: {
 *     content: {
 *       runtimeStyling: {
 *         enabled: true,
 *         fonts: { enabled: true },
 *         theme: { enabled: true },
 *       },
 *     },
 *   },
 * }
 * ```
 *
 * Shorthand booleans are accepted (`fonts: false`, `theme: false`).
 */
export const resolveContentRuntimeStylingConfig = (
  contentConfig: unknown,
): ContentRuntimeStylingConfig => {
  const source = toObject(contentConfig);
  const runtimeStyling = toObject(source.runtimeStyling);

  const enabled = toOptionalBoolean(runtimeStyling.enabled) ?? true;
  const fontsEnabled = enabled
    ? resolveNestedFeatureFlag(runtimeStyling.fonts, true)
    : false;
  const themeEnabled = enabled
    ? resolveNestedFeatureFlag(runtimeStyling.theme, true)
    : false;

  return {
    enabled,
    fontsEnabled,
    themeEnabled,
  };
};
