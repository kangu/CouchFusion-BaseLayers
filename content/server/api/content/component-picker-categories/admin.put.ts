import { createError, defineEventHandler, readBody } from "h3";
import { requireAdminSession } from "../../../utils/auth";
import { saveComponentPickerCategoriesSettings } from "../../../utils/component-picker-categories";

export default defineEventHandler(async (event) => {
  const session = await requireAdminSession(event);
  const body = await readBody<{ settings?: unknown }>(event);

  if (!body || typeof body !== "object") {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid payload.",
    });
  }

  const saved = await saveComponentPickerCategoriesSettings({
    settings: body.settings,
    updatedBy: session?.userCtx?.name ?? null,
  });

  return {
    success: true,
    settings: saved,
  };
});
