// Public REST API (Bearer API key). Read-only, for the app's single website.
import { createError, defineEventHandler, getRouterParam } from "h3";
import { resolveEngineConfig, storesLocally, type EngineConfig } from "../../../engine/config";
import { bearerToken, verifyApiKey, type ApiKeyDoc } from "../../../engine/platform";
import { getMetrics, getOverview, getRealtime } from "../../../engine/query";
import { loadVisits, sessionList } from "../../../engine/reports";
import { reportRoutes } from "../../../engine/report-routes";
import { dispatch, type Route } from "../../../engine/router";
import { ensureAppSite } from "../../../engine/sites";
import type { SiteDoc } from "../../../engine/types";

interface V1Context {
  config: EngineConfig;
  key: ApiKeyDoc;
  site: SiteDoc;
}

const runReport = reportRoutes.find((r) => r.path === "site/reports/:type")!.handler;

const routes: Route<V1Context>[] = [
  {
    method: "GET",
    path: "site",
    handler: ({ site }) => ({ site: { id: site.id, name: site.name, domains: site.domains, timezone: site.timezone } }),
  },
  { method: "GET", path: "stats", handler: (ctx) => getOverview(ctx.config, ctx.site, ctx.query) },
  { method: "GET", path: "metrics/:dim", handler: (ctx) => getMetrics(ctx.config, ctx.site, ctx.params.dim, ctx.query) },
  { method: "GET", path: "realtime", handler: (ctx) => getRealtime(ctx.config, ctx.site) },
  {
    method: "GET",
    path: "sessions",
    handler: async (ctx) => sessionList(await loadVisits(ctx.config, ctx.site, ctx.query), Number(ctx.query.offset) || 0, Math.min(200, Number(ctx.query.limit) || 50)),
  },
  {
    method: "POST",
    path: "reports/:type",
    handler: (ctx) => runReport({ ...ctx, user: { name: null, roles: [], isAdmin: false } } as any),
  },
];

export default defineEventHandler((event) =>
  dispatch(event, getRouterParam(event, "path") ?? "", routes, async () => {
    const config = await resolveEngineConfig(useRuntimeConfig());
    if (!storesLocally(config)) throw createError({ statusCode: 404, statusMessage: "Not found" });
    const key = await verifyApiKey(config, bearerToken(event));
    if (!key) throw createError({ statusCode: 401, statusMessage: "Invalid or missing API key" });
    return { config, key, site: await ensureAppSite(config) };
  }),
);
