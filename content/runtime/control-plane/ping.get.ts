import { defineEventHandler, setHeader } from "h3";
import { assertControlToken } from "./token";

/**
 * `GET /__couchfusion/control/ping` — readiness probe for the CouchFusion control plane.
 * Registered only in dev when `COUCHFUSION_CONTROL_TOKEN` is set; 404 without the token.
 */
export default defineEventHandler((event) => {
  assertControlToken(event);
  setHeader(event, "cache-control", "no-store");
  return { ready: true };
});
