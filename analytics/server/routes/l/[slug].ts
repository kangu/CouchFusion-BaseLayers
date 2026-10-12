// Tracked short link: /l/<slug> records a link-click event and redirects.
import { createError, defineEventHandler, getRouterParam, sendRedirect } from "h3";
import { resolveEngineConfig, storesLocally } from "../../engine/config";
import { getDoc } from "../../engine/couch";
import { recordServerHit, SLUG_PATTERN, type LinkDoc } from "../../engine/platform";
import { mainDb } from "../../engine/storage";

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, "slug") ?? "";
  const config = await resolveEngineConfig(useRuntimeConfig());
  if (!storesLocally(config) || !SLUG_PATTERN.test(slug)) throw createError({ statusCode: 404, statusMessage: "Not found" });
  const link = await getDoc<LinkDoc>(mainDb(config), `link:${slug}`);
  if (!link) throw createError({ statusCode: 404, statusMessage: "Not found" });
  await recordServerHit(event, config, link.site, {
    url: `/l/${slug}`,
    name: "link-click",
    data: { link: slug, url: link.url.slice(0, 200) },
  }).catch((error) => console.warn("[analytics] link hit failed:", error));
  return sendRedirect(event, link.url, 302);
});
