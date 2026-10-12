/**
 * Starts the in-app aggregator when the app stores analytics locally and
 * `analytics_aggregator_enabled` is not false. Runs every 60 s; a CouchDB
 * lease keeps multiple instances from writing concurrently.
 */
import { resolveEngineConfig, storesLocally } from "../engine/config";
import { releaseLease, runAggregatorTick } from "../engine/aggregator";
import { flushRawEvents } from "../engine/queue";

const TICK_MS = 60_000;

export default defineNitroPlugin((nitroApp) => {
  if (import.meta.prerender) return;
  let running = false;
  let stopped = false;

  const tick = async () => {
    if (running || stopped) return;
    running = true;
    try {
      const config = await resolveEngineConfig(useRuntimeConfig());
      if (storesLocally(config) && config.aggregatorEnabled) {
        await flushRawEvents();
        const result = await runAggregatorTick(config);
        if (import.meta.dev && result.leader) {
          const changed = Object.entries(result.written).filter(([, days]) => days.length);
          if (changed.length) console.info(`[analytics] rollups updated: ${changed.map(([site, days]) => `${site} ${days.join(",")}`).join("; ")}`);
        }
      }
    } catch (error) {
      console.error("[analytics] aggregator tick failed:", error);
    } finally {
      running = false;
    }
  };

  if (import.meta.dev) console.info("[analytics] aggregator scheduled (every 60 s)");
  const first = setTimeout(tick, 15_000);
  const interval = setInterval(tick, TICK_MS);
  first.unref?.();
  interval.unref?.();

  nitroApp.hooks.hook("close", async () => {
    stopped = true;
    clearTimeout(first);
    clearInterval(interval);
    await flushRawEvents().catch(() => undefined);
    const config = await resolveEngineConfig(useRuntimeConfig()).catch(() => null);
    if (config && storesLocally(config)) await releaseLease(config).catch(() => undefined);
  });
});
