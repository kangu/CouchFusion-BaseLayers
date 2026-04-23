import { createError, defineEventHandler, readBody } from "h3";
import { requireAdminSession } from "../../../utils/auth";
import { saveContentFontSettings } from "../../../utils/content-fonts";

/**
 * Admin API: persist selected font profile options (without downloading binaries).
 *
 * @remarks
 * The two-step model (`PUT settings` then `POST apply`) is deliberate:
 * - allows users to stage profile changes in UI,
 * - avoids expensive remote download/attachment operations on every form edit.
 */
export default defineEventHandler(async (event) => {
  const session = await requireAdminSession(event);
  const body = await readBody<{
    sansFamily?: unknown;
    displayFamily?: unknown;
    styles?: unknown;
    weights?: unknown;
    widths?: unknown;
  }>(event);

  if (!body || typeof body !== "object") {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid payload.",
    });
  }

  const { runtimeConfig, settings } = await saveContentFontSettings({
    sansFamily: body.sansFamily,
    displayFamily: body.displayFamily,
    styles: body.styles,
    weights: body.weights,
    widths: body.widths,
    updatedBy: session?.userCtx?.name ?? null,
  });

  return {
    success: true,
    allowlist: runtimeConfig.allowlist,
    section: runtimeConfig.section,
    settings,
  };
});
