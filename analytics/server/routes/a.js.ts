// Standalone tracker script (self-hosted mode only).
import { defineEventHandler, setResponseHeaders, createError } from "h3";
import { resolveEngineConfig, storesLocally } from "../engine/config";
import { TRACKER_SCRIPT } from "../engine/tracker-script";

export default defineEventHandler(async (event) => {
  const config = await resolveEngineConfig(useRuntimeConfig());
  if (!storesLocally(config)) throw createError({ statusCode: 404, statusMessage: "Not found" });
  setResponseHeaders(event, {
    "Content-Type": "application/javascript; charset=utf-8",
    "Cache-Control": "public, max-age=3600",
    "Access-Control-Allow-Origin": "*",
  });
  return TRACKER_SCRIPT;
});
