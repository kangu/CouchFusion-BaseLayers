import { createError, defineEventHandler, readBody } from "h3";
import { requireAdminSession } from "../../../utils/auth";
import { saveContentThemeSettings } from "../../../utils/content-theme";

/**
 * Admin API: save theme draft edits without publishing.
 */
export default defineEventHandler(async (event) => {
  const session = await requireAdminSession(event);
  const body = await readBody<{
    draftTokens?: unknown;
  }>(event);

  if (!body || typeof body !== "object") {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid payload.",
    });
  }

  const { schema, settings } = await saveContentThemeSettings({
    draftTokens: body.draftTokens ?? {},
    updatedBy: session?.userCtx?.name ?? null,
  });

  return {
    success: true,
    schema,
    settings,
  };
});
