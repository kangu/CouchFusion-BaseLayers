import { defineEventHandler, readBody, setHeader } from "h3";
import {
  checkPageOperations,
  parsePageOperationsRequest,
} from "#content/server/utils/control-page-operations";
import { assertControlToken } from "./token";

/**
 * `POST /__couchfusion/control/pages/check` — validates proposed page operations
 * against the live content database without writing anything.
 * Request `{ operations, baseRevs }`; response `{ ok, problems, preview }`.
 * Registered only in dev when `COUCHFUSION_CONTROL_TOKEN` is set; 404 without the token.
 */
export default defineEventHandler(async (event) => {
  assertControlToken(event);
  setHeader(event, "cache-control", "no-store");
  const request = parsePageOperationsRequest(await readBody(event));
  return await checkPageOperations(request);
});
