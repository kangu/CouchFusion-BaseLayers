import { defineEventHandler } from "h3";
import { requireAdminSession } from "../../../utils/auth";
import { getContentThemeSettings } from "../../../utils/content-theme";

/**
 * Admin API: fetch theme schema and current draft/applied settings.
 */
export default defineEventHandler(async (event) => {
  await requireAdminSession(event);

  const { schema, settings } = await getContentThemeSettings();
  return {
    success: true,
    schema,
    settings,
  };
});
