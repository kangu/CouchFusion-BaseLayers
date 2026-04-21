import { defineEventHandler } from "h3";
import { requireAdminSession } from "../../../utils/auth";
import { applyContentFonts } from "../../../utils/content-fonts";

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
