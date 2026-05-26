import { createError, defineEventHandler, readBody } from "h3";
import { requireAdminSession } from "../../../utils/auth";
import {
  getGlobalComponentsSettings,
  saveGlobalComponentsSettings,
} from "../../../utils/global-components-settings";
import { findGlobalComponentPageUsage } from "../../../utils/global-component-usage";
import { normalizeGlobalComponentEntries } from "#content/utils/global-components";

export default defineEventHandler(async (event) => {
  const session = await requireAdminSession(event);
  const body = await readBody<{ entries?: unknown }>(event);

  if (!body || typeof body !== "object") {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid payload.",
    });
  }
  if (!Array.isArray(body.entries)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Entries must be an array.",
    });
  }

  const normalizedEntries = normalizeGlobalComponentEntries(body.entries);
  if (normalizedEntries.length !== body.entries.length) {
    throw createError({
      statusCode: 400,
      statusMessage:
        "Invalid global component entries. Ensure unique ids and valid alias/component names.",
    });
  }

  const aliasIds = new Set(normalizedEntries.map((entry) => entry.id));
  for (const entry of normalizedEntries) {
    if (entry.component === entry.id) {
      throw createError({
        statusCode: 400,
        statusMessage: `Alias "${entry.id}" cannot target itself.`,
      });
    }
    if (aliasIds.has(entry.component)) {
      throw createError({
        statusCode: 400,
        statusMessage: `Alias "${entry.id}" cannot target another alias ("${entry.component}").`,
      });
    }
  }

  const existing = await getGlobalComponentsSettings();
  const nextAliasIds = new Set(normalizedEntries.map((entry) => entry.id));
  const removedEntries = (existing?.entries ?? []).filter(
    (entry) => !nextAliasIds.has(entry.id),
  );

  for (const removed of removedEntries) {
    const pages = await findGlobalComponentPageUsage(removed.id);
    if (pages.length > 0) {
      throw createError({
        statusCode: 409,
        statusMessage: `Global component "${removed.id}" is still used on ${pages.length} page${pages.length === 1 ? "" : "s"}.`,
        data: {
          aliasId: removed.id,
          pages,
        },
      });
    }
  }

  const saved = await saveGlobalComponentsSettings({
    entries: normalizedEntries,
    updatedBy: session?.userCtx?.name ?? null,
  });

  return {
    success: true,
    settings: saved,
  };
});
