import { createError, defineEventHandler, getQuery, setHeader } from "h3";
import {
  COMPONENT_ID_PATTERN,
  findComponentPageUsage,
} from "#content/server/utils/component-usage";
import { assertControlToken } from "./token";

/**
 * `GET /__couchfusion/control/component-usage?id=<kebab-id>` — pages (all locales)
 * that reference a content component, for the control plane's delete confirmation.
 * Registered only in dev when `COUCHFUSION_CONTROL_TOKEN` is set; 404 without the token.
 *
 * Response: `{ pages: [{ id, path, title }], scanned }`.
 */
export default defineEventHandler(async (event) => {
  assertControlToken(event);
  setHeader(event, "cache-control", "no-store");

  const rawId = getQuery(event).id;
  const id = typeof rawId === "string" ? rawId.trim() : "";
  if (!COMPONENT_ID_PATTERN.test(id)) {
    throw createError({ statusCode: 400, statusMessage: "Invalid component id." });
  }

  const { pages, scanned } = await findComponentPageUsage(id);
  return {
    pages: pages.map((page) => ({
      id: page.id,
      path: page.path,
      title: page.title ?? "",
    })),
    scanned,
  };
});
