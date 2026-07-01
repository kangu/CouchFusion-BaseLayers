import { createError, defineEventHandler, readBody } from "h3";
import { requireAdminSession } from "../../../utils/auth";
import { installContentFontFamily } from "../../../utils/content-fonts";

/**
 * Admin API: download one Bunny font family using the current typography profile.
 *
 * @remarks
 * This only installs the selected profile into CouchDB attachments and makes the
 * family selectable. Applying it to runtime pages still goes through `/apply`.
 */
export default defineEventHandler(async (event) => {
  const session = await requireAdminSession(event);
  const body = await readBody<{
    family?: unknown;
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

  const { runtimeConfig, settings, installedFamily } = await installContentFontFamily({
    family: body.family,
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
    installedFamily,
  };
});
