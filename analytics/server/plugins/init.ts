/**
 * Nitro server plugin for analytics initialization.
 * Runs on server startup so a missing config is visible before the first
 * event rather than swallowed on every one.
 */

import {
  assertUmamiConfigReady,
  logUmamiConfigSourceNotices,
  resolveUmamiConfigWithSources,
} from "../utils/umami-config";
import { forwardsToUmami, resolveEngineConfig, storesLocally } from "../engine/config";
import { ensureMainDb } from "../engine/storage";
import { ensureAppSite } from "../engine/sites";

async function initializeAnalyticsLayer(): Promise<void> {
  try {
    const engine = await resolveEngineConfig(useRuntimeConfig());
    console.info(`[analytics] mode: ${engine.mode} (from ${engine.section}.analytics_mode)`);

    if (forwardsToUmami(engine)) {
      const resolved = await resolveUmamiConfigWithSources(useRuntimeConfig());
      logUmamiConfigSourceNotices(resolved);
      assertUmamiConfigReady(resolved);
    }

    if (storesLocally(engine)) {
      const db = await ensureMainDb(engine);
      console.info(`[analytics] self-hosted storage: ${db} (+ ${db}_raw_<yyyy>_<mm>)`);
      const site = await ensureAppSite(engine);
      console.info(`[analytics] website: ${site.id} (${site.domains.join(", ") || "any hostname"}, ${site.timezone})`);
    }
  } catch (error) {
    console.error("💥 Analytics layer initialization failed:", error);
    // Don't throw: analytics must never keep the server from starting. The
    // startup notice above is the signal -- /api/stats still fails per request
    // until the config key exists.
  }
}

// Nitro plugin - runs on server startup
export default async () => {
  await initializeAnalyticsLayer();
};
