import { defineEventHandler } from "h3";
import { requireAdminSession } from "../../../utils/auth";
import { applyContentFonts } from "../../../utils/content-fonts";

/**
 * Admin API: execute font apply pipeline and persist runtime CSS/assets.
 *
 * @remarks
 * This endpoint performs network + CouchDB attachment work and is intentionally separate
 * from `settings.put` so the UI can explicitly control when the expensive operation runs.
 */
export default defineEventHandler(async (event) => {
  const session = await requireAdminSession(event);

  const { runtimeConfig, settings } = await applyContentFonts({
    updatedBy: session?.userCtx?.name ?? null,
  });

  return {
    success: true,
    allowlist: runtimeConfig.allowlist,
    section: runtimeConfig.section,
    settings,
  };
});
