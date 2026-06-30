import { defineEventHandler } from "h3";
import { requireAdminSession } from "../../../utils/auth";
import { getBunnyFontCatalog } from "../../../utils/content-fonts";

/**
 * Admin API: return the normalized Bunny font catalog for the builder browser.
 *
 * @remarks
 * The server fetches and caches Bunny's catalog so the editor can search/browse
 * without embedding a static font list in each consuming application.
 */
export default defineEventHandler(async (event) => {
  await requireAdminSession(event);

  return {
    success: true,
    fonts: await getBunnyFontCatalog(),
  };
});
