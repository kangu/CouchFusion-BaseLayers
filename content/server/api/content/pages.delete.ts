import { defineEventHandler, getQuery, createError } from "h3";
import { normalizePagePath } from "#content/utils/page";
import { getContentDatabaseName } from "../../utils/database";
import { requireAdminSession } from "../../utils/auth";
import { contentIdFromPath } from "../../utils/content-documents";
import { getDocument, deleteDocument } from "#database/utils/couchdb";

export default defineEventHandler(async (event) => {
  await requireAdminSession(event);

  try {
    const query = getQuery<{ path?: string }>(event);
    const path = query.path;

    if (!path) {
      throw createError({
        statusCode: 400,
        statusMessage: "Path query parameter is required.",
      });
    }

    const normalizedPath = normalizePagePath(path);
    const documentId = contentIdFromPath(normalizedPath);
    const databaseName = getContentDatabaseName();

    const existing = await getDocument<Record<string, any>>(
      databaseName,
      documentId,
    );

    if (!existing || !existing._rev) {
      throw createError({
        statusCode: 404,
        statusMessage: "Page not found.",
      });
    }

    const response = await deleteDocument(
      databaseName,
      existing._id,
      existing._rev,
    );

    return {
      success: true,
      id: response.id,
      rev: response.rev,
    };
  } catch (error: any) {
    if (error?.statusCode) {
      throw error;
    }

    console.error("Content pages DELETE error:", error);

    throw createError({
      statusCode: 500,
      statusMessage: "Failed to delete page.",
    });
  }
});
