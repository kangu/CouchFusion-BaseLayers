import { defineEventHandler } from "h3";
import { requireAdminSession } from "../../../utils/auth";
import { applyContentThemeSettings } from "../../../utils/content-theme";

/**
 * Admin API: publish saved theme draft to runtime CSS state.
 */
export default defineEventHandler(async (event) => {
  const session = await requireAdminSession(event);

  const { schema, settings } = await applyContentThemeSettings({
    updatedBy: session?.userCtx?.name ?? null,
  });

  return {
    success: true,
    schema,
    settings,
  };
});
