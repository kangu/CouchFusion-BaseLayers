import { createError, defineEventHandler, readBody } from "h3";
import { requireAdminSession } from "../../utils/auth";
import {
  getEffectiveContentI18nConfig,
  saveContentI18nSettingsOverride,
} from "../../utils/content-i18n-settings";

const asLocaleArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.map((entry) => String(entry ?? "")) : [];

export default defineEventHandler(async (event) => {
  const session = await requireAdminSession(event);
  const body = await readBody<{
    locales?: unknown;
    defaultLocale?: unknown;
  }>(event);

  if (!body || typeof body !== "object") {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid payload.",
    });
  }

  const { effective } = await getEffectiveContentI18nConfig();
  const requestedLocales = asLocaleArray(body.locales);
  const requestedDefaultLocale =
    typeof body.defaultLocale === "string"
      ? body.defaultLocale.trim().toLowerCase()
      : effective.defaultLocale;

  if (requestedDefaultLocale !== effective.defaultLocale) {
    throw createError({
      statusCode: 409,
      statusMessage:
        "Default locale change requires the migration action. Save locale toggles first, then run default-locale migration.",
    });
  }

  const saved = await saveContentI18nSettingsOverride({
    locales: requestedLocales,
    defaultLocale: requestedDefaultLocale,
    updatedBy: session?.userCtx?.name ?? null,
  });

  const { runtime, override, effective: nextEffective } =
    await getEffectiveContentI18nConfig();

  return {
    success: true,
    saved,
    runtime,
    override,
    effective: nextEffective,
  };
});
