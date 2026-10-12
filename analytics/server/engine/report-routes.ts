/**
 * P3 admin routes: reports, sessions explorer, saved segments and reports.
 */
import { randomBytes } from "node:crypto";
import { createError } from "h3";
import type { AdminContext, AdminRoute } from "./admin-routes";
import { collectRange, deleteDoc, getDoc, putDoc } from "./couch";
import { parseFilters, QueryError } from "./query";
import {
  attributionReport,
  breakdownReport,
  funnelReport,
  goalsReport,
  journeyReport,
  loadVisits,
  parseSteps,
  retentionReport,
  revenueReport,
  sessionDetail,
  sessionList,
  utmReport,
} from "./reports";
import { mainDb } from "./storage";
import type { SiteDoc } from "./types";

const site = (ctx: AdminContext): SiteDoc => {
  if (!ctx.site) throw createError({ statusCode: 404, statusMessage: "Not found" });
  return ctx.site;
};

export const REPORT_TYPES = ["goals", "funnel", "journey", "retention", "utm", "attribution", "revenue", "breakdown"] as const;

const runReport = async (ctx: AdminContext & { params: Record<string, string>; body: any }) => {
  const s = site(ctx);
  const body = ctx.body ?? {};
  const input = await loadVisits(ctx.config, s, body);
  switch (ctx.params.type) {
    case "goals": {
      const goals = Array.isArray(body.goals) && body.goals.length ? parseSteps(body.goals, 1, 50).map((g, i) => ({ id: `adhoc${i}`, name: g.value, ...g })) : s.goals;
      return goalsReport(input, goals);
    }
    case "funnel":
      return funnelReport(input, parseSteps(body.steps, 2, 10), Number(body.windowMinutes) || 60);
    case "journey": {
      const start = body.start?.value ? parseSteps([body.start])[0] : null;
      const end = body.end?.value ? parseSteps([body.end])[0] : null;
      return journeyReport(input, Number(body.steps) || 5, start, end);
    }
    case "retention":
      return retentionReport(input, Number(body.days) || 14);
    case "utm":
      return utmReport(input);
    case "attribution":
      return attributionReport(input, parseSteps([body.goal])[0], body.model === "first" ? "first" : "last");
    case "revenue":
      return revenueReport(input, typeof body.currency === "string" && body.currency ? body.currency.toUpperCase() : undefined);
    case "breakdown":
      return breakdownReport(input, Array.isArray(body.dims) ? body.dims : []);
    default:
      throw new QueryError(404, "Unknown report");
  }
};

const savedRoutes = (kind: "segment" | "report"): AdminRoute[] => {
  const prefix = (siteId: string) => `${kind}:${siteId}:`;
  const sanitize = (body: any) => {
    const name = String(body?.name ?? "").trim().slice(0, 100);
    if (!name) throw createError({ statusCode: 400, statusMessage: "Name required" });
    if (kind === "segment") return { name, filters: parseFilters(body?.filters) };
    if (!REPORT_TYPES.includes(body?.reportType)) throw createError({ statusCode: 400, statusMessage: "Invalid report type" });
    return { name, reportType: body.reportType, params: typeof body.params === "object" && body.params ? body.params : {} };
  };
  return [
    {
      method: "GET",
      path: `site/${kind}s`,
      handler: async (ctx) => ({
        items: (await collectRange(mainDb(ctx.config), prefix(site(ctx).id), `${prefix(site(ctx).id)}￰`)).map(({ _rev, ...doc }: any) => doc),
      }),
    },
    {
      method: "POST",
      path: `site/${kind}s`,
      handler: async (ctx) => {
        const doc = {
          _id: `${prefix(site(ctx).id)}${randomBytes(6).toString("hex")}`,
          type: kind,
          site: site(ctx).id,
          ...sanitize(ctx.body),
          createdBy: ctx.user.name,
          createdAt: new Date().toISOString(),
        };
        await putDoc(mainDb(ctx.config), doc);
        return { item: doc };
      },
    },
    {
      method: "DELETE",
      path: `site/${kind}s/:itemId`,
      handler: async (ctx) => {
        const id = ctx.params.itemId.startsWith(prefix(site(ctx).id)) ? ctx.params.itemId : `${prefix(site(ctx).id)}${ctx.params.itemId}`;
        const doc = await getDoc<{ _rev: string; createdBy?: string }>(mainDb(ctx.config), id);
        if (!doc) throw createError({ statusCode: 404, statusMessage: "Not found" });
        if (!ctx.user.isAdmin && doc.createdBy !== ctx.user.name) throw createError({ statusCode: 404, statusMessage: "Not found" });
        await deleteDoc(mainDb(ctx.config), id, doc._rev);
        return { ok: true };
      },
    },
  ];
};

export const reportRoutes: AdminRoute[] = [
  { method: "POST", path: "site/reports/:type", handler: (ctx) => runReport(ctx) },
  {
    method: "GET",
    path: "site/sessions",
    handler: async (ctx) => {
      const input = await loadVisits(ctx.config, site(ctx), ctx.query);
      return sessionList(input, Math.max(0, Number(ctx.query.offset) || 0), Math.min(200, Math.max(1, Number(ctx.query.limit) || 50)));
    },
  },
  { method: "GET", path: "site/sessions/:visit", handler: (ctx) => sessionDetail(ctx.config, site(ctx), ctx.params.visit) },
  ...savedRoutes("segment"),
  ...savedRoutes("report"),
];
