import {
  createError,
  defineEventHandler,
  getRouterParam,
  setHeader,
} from "h3";
import { getAttachment } from "#database/utils/couchdb";
import {
  CONTENT_FONT_ASSETS_DOC_ID,
} from "../../../../utils/content-fonts";
import { getContentDatabaseName, getMainDatabaseName } from "../../../../utils/database";

const FONT_ATTACHMENT_NAME_PATTERN = /^[a-z0-9._-]+\.woff2$/i;

/**
 * Public binary asset endpoint backed by CouchDB attachment storage.
 *
 * @remarks
 * Reads from content DB first (canonical location) and falls back to main DB only to
 * support legacy rollout states. Responses are long-cache immutable by deterministic name.
 */
export default defineEventHandler(async (event) => {
  const attachmentName = getRouterParam(event, "name");
  if (!attachmentName) {
    throw createError({
      statusCode: 400,
      statusMessage: "Missing font asset name.",
    });
  }

  if (!FONT_ATTACHMENT_NAME_PATTERN.test(attachmentName)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid font asset name.",
    });
  }

  const contentDatabaseName = getContentDatabaseName();
  const mainDatabaseName = getMainDatabaseName();

  let attachment = await getAttachment(
    contentDatabaseName,
    CONTENT_FONT_ASSETS_DOC_ID,
    attachmentName,
  );
  if (!attachment && mainDatabaseName !== contentDatabaseName) {
    attachment = await getAttachment(
      mainDatabaseName,
      CONTENT_FONT_ASSETS_DOC_ID,
      attachmentName,
    );
  }
  if (!attachment) {
    throw createError({
      statusCode: 404,
      statusMessage: `Font asset not found: ${attachmentName}.`,
    });
  }

  setHeader(event, "content-type", attachment.contentType || "font/woff2");
  setHeader(event, "cache-control", "public, max-age=31536000, immutable");
  setHeader(event, "x-content-font-asset", attachmentName);

  return attachment.data;
});
