// Tracking pixel: <img src="https://host/api/analytics/p/<token>.gif">
import { defineEventHandler, getRouterParam, setResponseHeaders } from "h3";
import { resolveEngineConfig, storesLocally } from "../../../engine/config";
import { getDoc } from "../../../engine/couch";
import { recordServerHit, type PixelDoc } from "../../../engine/platform";
import { mainDb } from "../../../engine/storage";

const GIF = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

export default defineEventHandler(async (event) => {
  setResponseHeaders(event, {
    "Content-Type": "image/gif",
    "Cache-Control": "no-store, max-age=0",
    "Access-Control-Allow-Origin": "*",
  });
  try {
    const token = (getRouterParam(event, "token") ?? "").replace(/\.gif$/, "");
    const config = await resolveEngineConfig(useRuntimeConfig());
    if (storesLocally(config) && /^[A-Za-z0-9_-]{8,40}$/.test(token)) {
      const pixel = await getDoc<PixelDoc>(mainDb(config), `pixel:${token}`);
      if (pixel) {
        await recordServerHit(event, config, pixel.site, {
          url: `/pixel/${encodeURIComponent(pixel.name)}`,
          name: "pixel-view",
          data: { pixel: pixel.name },
        });
      }
    }
  } catch (error) {
    console.warn("[analytics] pixel failed:", error);
  }
  return GIF;
});
