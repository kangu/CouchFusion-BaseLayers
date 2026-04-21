import { defineEventHandler } from "h3";
import { requireAdminSession } from "../../../utils/auth";
import { getContentFontSettings } from "../../../utils/content-fonts";

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
