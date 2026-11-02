import { createError, defineEventHandler, getQuery, setHeader } from "h3";
import { getControlPageDocuments } from "#content/server/utils/control-page-operations";
import { assertControlToken } from "./token";

const MAX_PATHS = 500;

/**
 * `GET /__couchfusion/control/page-documents?path=/a&path=/b` (or `all=1`) — every
 * locale document of the given pages (id, rev, title, seo, publicationState, layout,
 * body as the builder shows it). Unknown paths answer `documents: []`.
 * Registered only in dev when `COUCHFUSION_CONTROL_TOKEN` is set; 404 without the token.
 */
export default defineEventHandler(async (event) => {
  assertControlToken(event);
  setHeader(event, "cache-control", "no-store");

  const query = getQuery(event);
  const all = query.all === "1" || query.all === "true";
  const rawPaths = Array.isArray(query.path) ? query.path : query.path === undefined ? [] : [query.path];
  const paths = rawPaths.filter(
    (entry): entry is string => typeof entry === "string" && entry.trim().startsWith("/"),
  );
  if (!all && (paths.length === 0 || paths.length !== rawPaths.length)) {
    throw createError({ statusCode: 400, statusMessage: "Give one or more path=/… parameters or all=1." });
  }
  if (paths.length > MAX_PATHS) {
    throw createError({ statusCode: 400, statusMessage: `At most ${MAX_PATHS} paths per request.` });
  }

  return await getControlPageDocuments({ paths, all });
});
