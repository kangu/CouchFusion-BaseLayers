import { createError, defineEventHandler, readBody } from "h3";
import { requireAdminSession } from "../../../utils/auth";
import { saveContentFontSettings } from "../../../utils/content-fonts";

export default defineEventHandler(async (event) => {
  const session = await requireAdminSession(event);
  const body = await readBody<{ sansFamily?: unknown; displayFamily?: unknown }>(event);

  if (!body || typeof body !== "object") {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid payload.",
    });
  }

  const { runtimeConfig, settings } = await saveContentFontSettings({
    sansFamily: body.sansFamily,
    displayFamily: body.displayFamily,
    updatedBy: session?.userCtx?.name ?? null,
  });

  return {
    success: true,
    allowlist: runtimeConfig.allowlist,
    section: runtimeConfig.section,
    settings,
  };
});
