/**
 * Admin / viewer API: `/api/analytics/admin/**`.
 */
import { createError, setResponseHeaders } from "h3";
import { forwardsToUmami, resetEngineConfigCache, resolveEngineConfig, storesLocally, type EngineConfig } from "./config";
import { canReadSite, requireUser, notFound, type AnalyticsUser } from "./access";
import { rebuildRange, resetSiteData } from "./aggregator";
import { toCsv } from "./csv";
import { getMetrics, getOverview, getRealtime, resolveRange } from "./query";
import { geoStats, outcomeStats } from "./collector";
import { pendingRawEvents } from "./queue";
import { ensureAppSite, sanitizeSite, saveSite, setShareToken } from "./sites";
import { mainDb } from "./storage";
import type { Route, RouteContext } from "./router";
import type { SiteDoc } from "./types";
import { isValidTimeZone, normalizeDayInput } from "./time";
import { readCouchConfigValues, writeCouchConfigValue } from "#database/utils/couch-config";
import { parseCidrList } from "./net";

export interface AdminContext {
  config: EngineConfig;
  user: AnalyticsUser;
  site: SiteDoc | null;
}

export type AdminRoute = Route<AdminContext> & { admin?: boolean };

const requireSite = (ctx: AdminContext): SiteDoc => {
  if (!ctx.site) throw notFound();
  return ctx.site;
};

const adminOnly = (ctx: AdminContext) => {
  if (!ctx.user.isAdmin) throw notFound();
};

const publicSite = (site: SiteDoc, user: AnalyticsUser) => {
  const { _rev, ...rest } = site;
  return user.isAdmin ? rest : { ...rest, shareToken: null, allowedRoles: [] };
};

/** `_config` keys editable from the admin UI (flat strings). */
export const EDITABLE_SETTINGS = [
  "analytics_mode",
  "analytics_ignore_ips",
  "analytics_respect_dnt",
  "analytics_raw_retention_months",
  "analytics_max_scan_days",
  "analytics_persistent_id",
  "analytics_geo_source",
  "analytics_aggregator_enabled",
] as const;

const validateSetting = (key: string, value: string) => {
  const fail = (message: string) => {
    throw createError({ statusCode: 400, statusMessage: `${key}: ${message}` });
  };
  if (value === "") return;
  if (key === "analytics_mode" && !["umami_cloud", "self_hosted", "dual"].includes(value)) fail("umami_cloud | self_hosted | dual");
  if (key === "analytics_geo_source" && !["header", "none"].includes(value)) fail("header | none");
  if (["analytics_respect_dnt", "analytics_persistent_id", "analytics_aggregator_enabled"].includes(key) && !["true", "false"].includes(value)) fail("true | false");
  if (["analytics_raw_retention_months", "analytics_max_scan_days"].includes(key) && !/^\d{1,4}$/.test(value)) fail("number expected");
  if (key === "analytics_ignore_ips") {
    const entries = value.split(",").map((v) => v.trim()).filter(Boolean);
    if (parseCidrList(value).length !== entries.length) fail("invalid IP/CIDR entry");
  }
};

export const coreAdminRoutes: AdminRoute[] = [
  {
    method: "GET",
    path: "status",
    handler: ({ config, user }) => ({
      mode: config.mode,
      slug: config.slug,
      section: config.section,
      storesLocally: storesLocally(config),
      forwardsToUmami: forwardsToUmami(config),
      siteId: config.defaultSiteId,
      aggregatorEnabled: config.aggregatorEnabled,
      persistentId: config.persistentId,
      maxScanDays: config.maxScanDays,
      rawRetentionMonths: config.rawRetentionMonths,
      database: user.isAdmin ? mainDb(config) : undefined,
      pendingEvents: pendingRawEvents(),
      geo: { source: config.geoSource, ...geoStats },
      outcomes: { ...outcomeStats },
      user: { name: user.name, isAdmin: user.isAdmin },
    }),
  },
  {
    method: "POST",
    path: "status/refresh",
    admin: true,
    handler: async () => {
      resetEngineConfigCache();
      return { ok: true };
    },
  },
  {
    method: "GET",
    path: "settings",
    admin: true,
    handler: async ({ config }) => ({
      section: config.section,
      values: await readCouchConfigValues(config.section, [...EDITABLE_SETTINGS]),
    }),
  },
  {
    method: "PUT",
    path: "settings",
    admin: true,
    handler: async ({ config, body }) => {
      const updates = body?.values ?? {};
      const written: string[] = [];
      for (const key of EDITABLE_SETTINGS) {
        if (!(key in updates)) continue;
        const value = String(updates[key] ?? "").trim();
        validateSetting(key, value);
        if (!(await writeCouchConfigValue(config.section, key, value))) {
          throw createError({ statusCode: 502, statusMessage: `Could not write ${config.section}.${key}` });
        }
        written.push(key);
      }
      resetEngineConfigCache();
      return { ok: true, written };
    },
  },
  {
    method: "GET",
    path: "site",
    handler: (ctx) => ({ site: publicSite(requireSite(ctx), ctx.user) }),
  },
  {
    method: "PUT",
    path: "site",
    admin: true,
    handler: async (ctx) => {
      const existing = requireSite(ctx);
      if (ctx.body?.timezone && !isValidTimeZone(ctx.body.timezone)) {
        throw createError({ statusCode: 400, statusMessage: "Invalid timezone" });
      }
      return { site: await saveSite(ctx.config, sanitizeSite(ctx.body ?? {}, existing)) };
    },
  },
  {
    method: "POST",
    path: "site/share",
    admin: true,
    handler: async (ctx) => ({
      site: await setShareToken(ctx.config, requireSite(ctx), ctx.body?.enabled !== false),
    }),
  },
  {
    method: "GET",
    path: "site/overview",
    handler: (ctx) => getOverview(ctx.config, requireSite(ctx), ctx.query),
  },
  {
    method: "GET",
    path: "site/metrics/:dim",
    handler: (ctx) => getMetrics(ctx.config, requireSite(ctx), ctx.params.dim, ctx.query),
  },
  {
    method: "GET",
    path: "site/realtime",
    handler: (ctx) => getRealtime(ctx.config, requireSite(ctx)),
  },
  {
    method: "POST",
    path: "site/rebuild",
    admin: true,
    handler: async (ctx) => {
      const site = requireSite(ctx);
      const from = normalizeDayInput(ctx.body?.from);
      const to = normalizeDayInput(ctx.body?.to) ?? from;
      if (!from || !to) throw createError({ statusCode: 400, statusMessage: "from/to required (YYYY-MM-DD)" });
      return rebuildRange(ctx.config, site, from <= to ? from : to, from <= to ? to : from);
    },
  },
  {
    method: "POST",
    path: "site/reset",
    admin: true,
    handler: async (ctx) => {
      if (ctx.body?.confirm !== requireSite(ctx).id) {
        throw createError({ statusCode: 400, statusMessage: "Type the site id to confirm" });
      }
      return resetSiteData(ctx.config, requireSite(ctx));
    },
  },
  {
    method: "GET",
    path: "site/export",
    handler: async (ctx) => {
      const site = requireSite(ctx);
      const dim = String(ctx.query.dim ?? "page");
      const result = await getMetrics(ctx.config, site, dim, { ...ctx.query, limit: 500, offset: 0 });
      const range = resolveRange(ctx.query, site.timezone);
      setResponseHeaders(ctx.event, {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${site.id}-${dim}-${range.from}-${range.to}.csv"`,
      });
      return toCsv(
        [dim, "visitors", "visits", "pageviews", "events", "bounce_rate", "avg_duration_s"],
        result.rows.map((row) => [row.value.replace(/\u001f/g, " / "), row.v ?? 0, row.vi ?? 0, row.pv ?? 0, row.c ?? 0, row.bounceRate ?? "", row.avgDuration ?? ""]),
      );
    },
  },
];


/** Builds the admin context: config, user, site (with read access check). */
export const buildAdminContext = async (base: RouteContext, route?: Route<AdminContext>): Promise<AdminContext> => {
  const user = await requireUser(base.event);
  const config = await resolveEngineConfig(useRuntimeConfig());
  if (!storesLocally(config) && !/\/(status|settings)/.test(base.event.path)) {
    throw createError({ statusCode: 409, statusMessage: `Self-hosted analytics is disabled (analytics_mode=${config.mode})` });
  }
  // One website per app: every `site/**` route works on it.
  let site: SiteDoc | null = null;
  if (/^site(\/|$)/.test(route?.path ?? "")) {
    site = await ensureAppSite(config, { fresh: true });
    if (!canReadSite(user, site)) throw notFound();
  }
  const ctx: AdminContext = { config, user, site };
  if ((route as AdminRoute | undefined)?.admin) adminOnly(ctx);
  return ctx;
};
