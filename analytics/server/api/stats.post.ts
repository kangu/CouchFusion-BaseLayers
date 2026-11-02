// Ingestion endpoint: validates the body and stores the hit in the app's
// self-hosted analytics database. Needs no CouchDB `_config` keys.
import { defineEventHandler, createError } from "h3";

import { collectHit } from "../engine/collector";
import { applyCollectCors } from "../engine/cors";
import { resolveEngineConfig } from "../engine/config";
import { readLimitedBody, STATS_BODY_LIMIT } from "../engine/body";

export default defineEventHandler(async (event) => {
  const engine = await resolveEngineConfig(useRuntimeConfig());
  await applyCollectCors(event, engine);

  // The standalone tracker sends text/plain (no CORS preflight); the reader
  // parses JSON either way. Oversized bodies are cut off with 413.
  let body: unknown;
  try {
    body = await readLimitedBody(event, STATS_BODY_LIMIT);
  } catch (error: any) {
    if (error?.statusCode === 413) throw error;
    body = null;
  }
  if (!body || typeof body !== "object") {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid payload: expected JSON body",
    });
  }

  const { payload } = body as {
    payload?: Record<string, any>;
  };

  if (!payload || typeof payload !== "object") {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid payload: payload object is required",
    });
  }

  try {
    await collectHit(event, body, engine);
  } catch (error) {
    // Analytics must never break the page: log and still answer ok.
    console.error("[analytics] local collection failed:", error);
  }

  return { ok: true };
});
