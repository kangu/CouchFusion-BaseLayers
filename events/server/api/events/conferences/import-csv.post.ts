import { createError, defineEventHandler, readBody } from "h3";
import { getDocument, putDocument } from "#database/utils/couchdb";
import type { ConferenceDocument } from "../../../utils/conference-csv";
import { parseConferenceCsv } from "../../../utils/conference-csv";
import { ensureEventsDatabase } from "../../../utils/events-db";
import { assertEventsAdminSession } from "../../../utils/assert-events-admin-session";

interface ImportCsvPayload {
  csvText?: string;
  dryRun?: boolean;
}

const applyExistingRevision = async (
  databaseName: string,
  conference: ConferenceDocument,
) => {
  try {
    const existing = await getDocument<ConferenceDocument>(
      databaseName,
      conference._id,
    );
    if (!existing) return conference;

    return {
      ...conference,
      _rev: existing._rev,
      isPublished:
        typeof existing.isPublished === "boolean"
          ? existing.isPublished
          : conference.isPublished,
      createdAt:
        typeof existing.createdAt === "string" && existing.createdAt.length
          ? existing.createdAt
          : conference.createdAt,
      updatedAt: new Date().toISOString(),
    };
  } catch {
    return conference;
  }
};

export default defineEventHandler(async (event) => {
  await assertEventsAdminSession(event);

  const payload = await readBody<ImportCsvPayload>(event);
  const csvText = typeof payload?.csvText === "string" ? payload.csvText : "";
  const dryRun = payload?.dryRun !== false;

  if (!csvText.trim()) {
    throw createError({
      statusCode: 400,
      statusMessage: "csvText is required",
    });
  }

  const parsed = parseConferenceCsv(csvText);
  const preview = parsed.conferences.slice(0, 30);

  if (dryRun) {
    return {
      success: true,
      dryRun: true,
      imported: 0,
      preview,
      warnings: parsed.warnings,
      meta: parsed.meta,
    };
  }

  const databaseName = await ensureEventsDatabase();
  let imported = 0;

  for (const conference of parsed.conferences) {
    const withRevision = await applyExistingRevision(databaseName, conference);
    await putDocument(databaseName, withRevision);
    imported += 1;
  }

  return {
    success: true,
    dryRun: false,
    imported,
    preview,
    warnings: parsed.warnings,
    meta: parsed.meta,
  };
});
