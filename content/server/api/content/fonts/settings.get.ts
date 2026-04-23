import { defineEventHandler } from "h3";
import { requireAdminSession } from "../../../utils/auth";
import { getContentFontSettings } from "../../../utils/content-fonts";

/**
 * Admin API: return editable font settings + runtime allowlist metadata.
 *
 * @remarks
 * This endpoint is intentionally admin-protected because it exposes control-surface data
 * used by the content builder. Runtime pages consume only generated CSS/asset endpoints.
 */
export default defineEventHandler(async (event) => {
  await requireAdminSession(event);

  const { runtimeConfig, settings } = await getContentFontSettings();
  return {
    success: true,
    allowlist: runtimeConfig.allowlist,
    section: runtimeConfig.section,
    settings,
  };
});
