import { defineEventHandler } from "h3";
import { requireAdminSession } from "../../utils/auth";
import { getEffectiveContentI18nConfig } from "../../utils/content-i18n-settings";

export default defineEventHandler(async (event) => {
  await requireAdminSession(event);

  const { runtime, override, effective } = await getEffectiveContentI18nConfig();

  return {
    success: true,
    runtime,
    override,
    effective,
  };
});
