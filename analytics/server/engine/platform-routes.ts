/**
 * P4 admin routes: API keys, pixels, links, imports.
 */
import { createError } from "h3";
import type { AdminContext, AdminRoute } from "./admin-routes";
import { collectRange, deleteDoc, getDoc } from "./couch";
import { importFathom, importUmami } from "./importer";
import { createApiKey, createLink, createPixel, listApiKeys } from "./platform";
import { mainDb } from "./storage";
import type { SiteDoc } from "./types";

const site = (ctx: AdminContext): SiteDoc => {
  if (!ctx.site) throw createError({ statusCode: 404, statusMessage: "Not found" });
  return ctx.site;
};

const MAX_IMPORT_CHARS = 50 * 1024 * 1024;

const removeDoc = async (ctx: AdminContext, id: string, siteId?: string) => {
  const doc = await getDoc<{ _rev: string; site?: string }>(mainDb(ctx.config), id);
  if (!doc || (siteId && doc.site !== siteId)) throw createError({ statusCode: 404, statusMessage: "Not found" });
  await deleteDoc(mainDb(ctx.config), id, doc._rev);
  return { ok: true };
};

export const platformRoutes: AdminRoute[] = [
  { method: "GET", path: "api-keys", admin: true, handler: async (ctx) => ({ items: await listApiKeys(ctx.config) }) },
  {
    method: "POST",
    path: "api-keys",
    admin: true,
    handler: (ctx) => createApiKey(ctx.config, String(ctx.body?.name ?? ""), ctx.user.name),
  },
  {
    method: "DELETE",
    path: "api-keys/:keyId",
    admin: true,
    handler: (ctx) => {
      if (!/^[0-9a-f]{64}$/.test(ctx.params.keyId)) throw createError({ statusCode: 404, statusMessage: "Not found" });
      return removeDoc(ctx, `apikey:${ctx.params.keyId}`);
    },
  },
  {
    method: "GET",
    path: "site/pixels",
    admin: true,
    handler: async (ctx) => ({
      items: (await collectRange<any>(mainDb(ctx.config), "pixel:", "pixel:￰"))
        .filter((p) => p.site === site(ctx).id)
        .map(({ _rev, ...p }) => ({ ...p, token: p._id.slice(6) })),
    }),
  },
  { method: "POST", path: "site/pixels", admin: true, handler: async (ctx) => ({ item: await createPixel(ctx.config, site(ctx), String(ctx.body?.name ?? "")) }) },
  { method: "DELETE", path: "site/pixels/:token", admin: true, handler: (ctx) => removeDoc(ctx, `pixel:${ctx.params.token}`, site(ctx).id) },
  {
    method: "GET",
    path: "site/links",
    admin: true,
    handler: async (ctx) => ({
      items: (await collectRange<any>(mainDb(ctx.config), "link:", "link:￰")).filter((l) => l.site === site(ctx).id).map(({ _rev, ...l }) => l),
    }),
  },
  { method: "POST", path: "site/links", admin: true, handler: async (ctx) => ({ item: await createLink(ctx.config, site(ctx), ctx.body ?? {}) }) },
  { method: "DELETE", path: "site/links/:slug", admin: true, handler: (ctx) => removeDoc(ctx, `link:${ctx.params.slug}`, site(ctx).id) },
  {
    method: "POST",
    path: "site/import",
    admin: true,
    handler: async (ctx) => {
      const body = ctx.body ?? {};
      const size = JSON.stringify(body).length;
      if (size > MAX_IMPORT_CHARS) throw createError({ statusCode: 413, statusMessage: "Import too large (max 50 MB per request)" });
      if (body.format === "umami") {
        if (typeof body.events !== "string" || !body.events.trim()) throw createError({ statusCode: 400, statusMessage: "events CSV required" });
        return importUmami(ctx.config, site(ctx), body.events, typeof body.sessions === "string" ? body.sessions : undefined);
      }
      if (body.format === "fathom") {
        if (![body.siteStats, body.pageStats, body.referrerStats].some((v) => typeof v === "string" && v.trim())) {
          throw createError({ statusCode: 400, statusMessage: "At least one Fathom CSV required" });
        }
        return importFathom(ctx.config, site(ctx), { siteStats: body.siteStats, pageStats: body.pageStats, referrerStats: body.referrerStats });
      }
      throw createError({ statusCode: 400, statusMessage: "format must be umami or fathom" });
    },
  },
];
