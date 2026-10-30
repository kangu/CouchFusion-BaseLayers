/**
 * Nitro server plugin for analytics initialization.
 * Provisions the app's analytics databases and website record on startup, so
 * analytics works as soon as the layer is installed (no `_config` keys needed).
 */

import { resolveEngineConfig } from "../engine/config";
import { ensureMainDb } from "../engine/storage";
import { ensureAppSite } from "../engine/sites";

async function initializeAnalyticsLayer(): Promise<void> {
  try {
    const engine = await resolveEngineConfig(useRuntimeConfig());
    if (!engine.loaded) {
      // The first hit after CouchDB answers provisions everything instead.
      console.warn(`[analytics] _config ${engine.section} unreadable at startup; storage is set up once it can be read`);
      return;
    }
    const db = await ensureMainDb(engine);
    console.info(`[analytics] storage: ${db} (+ ${db}_raw_<yyyy>_<mm>)`);
    const site = await ensureAppSite(engine);
    console.info(`[analytics] website: ${site.id} (${site.domains.join(", ") || "any hostname"}, ${site.timezone})`);
  } catch (error) {
    console.error("💥 Analytics layer initialization failed:", error);
    // Don't throw: analytics must never keep the server from starting.
  }
}

// Nitro plugin - runs on server startup
export default async () => {
  await initializeAnalyticsLayer();
};
