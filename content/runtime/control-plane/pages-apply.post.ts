import { defineEventHandler, readBody, setHeader, setResponseStatus } from "h3";
import {
  applyPageOperations,
  parsePageOperationsRequest,
} from "#content/server/utils/control-page-operations";
import { assertControlToken } from "./token";

/**
 * `POST /__couchfusion/control/pages/apply` — re-runs the check and, when it passes,
 * applies the operations in order with the content layer's save/rename/publication
 * helpers. `409 { ok: false, problems }` writes nothing; a failure after some writes
 * answers `500 { ok: false, applied, failed: { index, message } }`; success is
 * `{ ok: true, applied: [{ index, path, documents: [{ id, rev }] }] }`.
 * Registered only in dev when `COUCHFUSION_CONTROL_TOKEN` is set; 404 without the token.
 */
export default defineEventHandler(async (event) => {
  assertControlToken(event);
  setHeader(event, "cache-control", "no-store");
  const request = parsePageOperationsRequest(await readBody(event));
  const result = await applyPageOperations(request);
  setResponseStatus(event, result.status);
  return result.body;
});
