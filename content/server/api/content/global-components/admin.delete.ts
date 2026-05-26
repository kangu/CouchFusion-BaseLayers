import { createError, defineEventHandler, getQuery } from "h3";
import { requireAdminSession } from "../../../utils/auth";
import {
  getGlobalComponentsSettings,
  saveGlobalComponentsSettings,
} from "../../../utils/global-components-settings";
import { findGlobalComponentPageUsage } from "../../../utils/global-component-usage";
import { normalizeGlobalComponentId } from "#content/utils/global-components";

export default defineEventHandler(async (event) => {
  const session = await requireAdminSession(event);
  const query = getQuery(event);
  const aliasId = normalizeGlobalComponentId(query.id);

  if (!aliasId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Valid global component id is required.",
    });
  }

  const settings = await getGlobalComponentsSettings();
  const entries = settings?.entries ?? [];
  const target = entries.find((entry) => entry.id === aliasId);
  if (!target) {
    throw createError({
      statusCode: 404,
      statusMessage: `Global component "${aliasId}" was not found.`,
    });
  }

  const pages = await findGlobalComponentPageUsage(aliasId);
  if (pages.length > 0) {
    throw createError({
      statusCode: 409,
      statusMessage: `Global component "${aliasId}" is still used on ${pages.length} page${pages.length === 1 ? "" : "s"}.`,
      data: {
        aliasId,
        pages,
      },
    });
  }

  const saved = await saveGlobalComponentsSettings({
    entries: entries.filter((entry) => entry.id !== aliasId),
    updatedBy: session?.userCtx?.name ?? null,
  });

  return {
    success: true,
    deletedId: aliasId,
    settings: saved,
  };
});
