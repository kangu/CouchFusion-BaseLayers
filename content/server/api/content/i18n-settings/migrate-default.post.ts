import { createError, defineEventHandler, readBody } from "h3";
import { requireAdminSession } from "../../../utils/auth";
import {
  getEffectiveContentI18nConfig,
  saveContentI18nSettingsOverride,
} from "../../../utils/content-i18n-settings";
import { migrateContentDefaultLocale } from "../../../utils/content-i18n-migration";

const normalizeStrategy = (value: unknown): "strict" | "fallback-copy" =>
  value === "fallback-copy" ? "fallback-copy" : "strict";

export default defineEventHandler(async (event) => {
  const session = await requireAdminSession(event);
  const body = await readBody<{
    defaultLocale?: unknown;
    strategy?: unknown;
  }>(event);

  if (!body || typeof body !== "object") {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid payload.",
    });
  }

  const nextDefaultLocale =
    typeof body.defaultLocale === "string"
      ? body.defaultLocale.trim().toLowerCase()
      : "";
  if (!nextDefaultLocale) {
    throw createError({
      statusCode: 400,
      statusMessage: "defaultLocale is required.",
    });
  }

  const strategy = normalizeStrategy(body.strategy);
  const { effective } = await getEffectiveContentI18nConfig();

  const migration = await migrateContentDefaultLocale({
    currentConfig: effective,
    nextDefaultLocale,
    strategy,
  });

  await saveContentI18nSettingsOverride({
    locales: effective.locales,
    defaultLocale: nextDefaultLocale,
    updatedBy: session?.userCtx?.name ?? null,
  });

  const { runtime, override, effective: nextEffective } =
    await getEffectiveContentI18nConfig();

  return {
    success: true,
    migration,
    runtime,
    override,
    effective: nextEffective,
  };
});
