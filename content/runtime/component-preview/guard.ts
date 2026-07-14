import { timingSafeEqual } from "node:crypto";
import {
  createError,
  defineEventHandler,
  getQuery,
  getRequestURL,
} from "h3";

const PREVIEW_PATH_PREFIX = "/__couchfusion/components/";

const matchingToken = (supplied: string, expected: string): boolean => {
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

export const validPreviewRequest = (
  path: string,
  suppliedToken: string,
  expectedToken: string,
): boolean =>
  !path.startsWith(PREVIEW_PATH_PREFIX) ||
  matchingToken(suppliedToken, expectedToken);

export default defineEventHandler((event) => {
  const path = getRequestURL(event).pathname;
  if (!path.startsWith(PREVIEW_PATH_PREFIX)) {
    return;
  }
  const token = getQuery(event).token;
  const suppliedToken = typeof token === "string" ? token : "";
  if (
    !validPreviewRequest(
      path,
      suppliedToken,
      process.env.COUCHFUSION_PREVIEW_TOKEN || "",
    )
  ) {
    throw createError({ statusCode: 404, statusMessage: "Not Found" });
  }
});
