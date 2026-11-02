import { defineEventHandler, setHeader } from "h3";
import { listControlPages } from "#content/server/utils/control-page-operations";
import { assertControlToken } from "./token";

/**
 * `GET /__couchfusion/control/pages` — current content pages (no `oldpage-*`
 * history), one entry per base path, sorted by path, for the LLM request context.
 * Registered only in dev when `COUCHFUSION_CONTROL_TOKEN` is set; 404 without the token.
 *
 * Response: `{ defaultLocale, locales, pages: [{ path, title, publicationState,
 * locales, redirect: { to, status } | null, updatedAt }] }`.
 */
export default defineEventHandler(async (event) => {
  assertControlToken(event);
  setHeader(event, "cache-control", "no-store");
  return await listControlPages();
});
