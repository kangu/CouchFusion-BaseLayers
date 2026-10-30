import { timingSafeEqual } from "node:crypto";
import { createError, getHeader, type H3Event } from "h3";

/** Header carrying the per-start token issued by the CouchFusion control plane. */
export const CONTROL_TOKEN_HEADER = "x-couchfusion-control-token";

/**
 * Constant-time comparison of the supplied control token with the expected one.
 * Empty values never match.
 */
export const validControlToken = (supplied: string, expected: string): boolean => {
  if (!supplied || !expected) {
    return false;
  }
  const suppliedBytes = Buffer.from(supplied);
  const expectedBytes = Buffer.from(expected);
  return (
    suppliedBytes.length === expectedBytes.length &&
    timingSafeEqual(suppliedBytes, expectedBytes)
  );
};

/**
 * Reject the request with a plain 404 unless it carries the control token from
 * `COUCHFUSION_CONTROL_TOKEN`. A 404 (not 401) keeps the routes invisible.
 */
export const assertControlToken = (event: H3Event): void => {
  const supplied = getHeader(event, CONTROL_TOKEN_HEADER) ?? "";
  if (!validControlToken(supplied, process.env.COUCHFUSION_CONTROL_TOKEN || "")) {
    throw createError({ statusCode: 404, statusMessage: "Not Found" });
  }
};
