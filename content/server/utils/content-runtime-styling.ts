import { createError } from "h3";
import { resolveContentRuntimeStylingConfig } from "#content/utils/runtime-styling";

const getRuntimeStylingConfigSource = (): unknown => {
  const runtimeConfig = useRuntimeConfig();
  return runtimeConfig.content ?? runtimeConfig.public?.content ?? {};
};

/** Resolve normalized runtime styling feature flags for current request context. */
export const getContentRuntimeStylingConfig = () =>
  resolveContentRuntimeStylingConfig(getRuntimeStylingConfigSource());

/**
 * Fail current request when runtime font endpoints are disabled by implementing app config.
 */
export const assertContentRuntimeFontsEnabled = () => {
  const config = getContentRuntimeStylingConfig();
  if (config.fontsEnabled) {
    return;
  }

  throw createError({
    statusCode: 404,
    statusMessage: "Content runtime fonts feature is disabled.",
  });
};

/**
 * Fail current request when runtime theme endpoints are disabled by implementing app config.
 */
export const assertContentRuntimeThemeEnabled = () => {
  const config = getContentRuntimeStylingConfig();
  if (config.themeEnabled) {
    return;
  }

  throw createError({
    statusCode: 404,
    statusMessage: "Content runtime theme feature is disabled.",
  });
};
