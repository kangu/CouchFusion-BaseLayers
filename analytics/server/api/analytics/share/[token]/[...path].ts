// Public, read-only analytics for the website's share token.
import { createError, defineEventHandler, getRouterParam } from "h3";
import { resolveEngineConfig, storesLocally } from "../../../../engine/config";
import { getMetrics, getOverview, getRealtime } from "../../../../engine/query";
import { dispatch, type Route } from "../../../../engine/router";
import { findSiteByShareToken } from "../../../../engine/sites";
import type { EngineConfig } from "../../../../engine/config";
import type { SiteDoc } from "../../../../engine/types";

interface ShareContext {
  config: EngineConfig;
  site: SiteDoc;
}

const routes: Route<ShareContext>[] = [
  {
    method: "GET",
    path: "site",
    handler: ({ site }) => ({ site: { id: site.id, name: site.name, timezone: site.timezone, domains: site.domains } }),
  },
  { method: "GET", path: "site/overview", handler: (ctx) => getOverview(ctx.config, ctx.site, ctx.query) },
  { method: "GET", path: "site/metrics/:dim", handler: (ctx) => getMetrics(ctx.config, ctx.site, ctx.params.dim, ctx.query) },
  { method: "GET", path: "site/realtime", handler: (ctx) => getRealtime(ctx.config, ctx.site) },
];

export default defineEventHandler((event) =>
  dispatch(event, getRouterParam(event, "path") ?? "", routes, async () => {
    const config = await resolveEngineConfig(useRuntimeConfig());
    const site = storesLocally(config) ? await findSiteByShareToken(config, getRouterParam(event, "token") ?? "") : null;
    if (!site) throw createError({ statusCode: 404, statusMessage: "Not found" });
    return { config, site };
  }),
);
