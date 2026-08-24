/**
 * Nitro server plugin for analytics initialization.
 * Runs on server startup so a missing Umami config is visible before the first
 * event rather than swallowed on every one.
 */

import {
  assertUmamiConfigReady,
  logUmamiConfigSourceNotices,
  resolveUmamiConfigWithSources,
} from "../utils/umami-config";

async function initializeAnalyticsLayer(): Promise<void> {
  try {
    const resolved = await resolveUmamiConfigWithSources(useRuntimeConfig());

    logUmamiConfigSourceNotices(resolved);
    assertUmamiConfigReady(resolved);
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
