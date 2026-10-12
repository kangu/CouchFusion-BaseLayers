// CORS preflight for cross-origin trackers (standalone /a.js on other domains).
import { defineEventHandler, setResponseStatus } from "h3";
import { resolveEngineConfig, storesLocally } from "../engine/config";
import { applyCollectCors } from "../engine/cors";

export default defineEventHandler(async (event) => {
  const engine = await resolveEngineConfig(useRuntimeConfig());
  if (storesLocally(engine)) await applyCollectCors(event, engine);
  setResponseStatus(event, 204);
  return "";
});
