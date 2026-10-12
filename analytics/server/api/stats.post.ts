// Ingestion endpoint. Depending on CouchDB `analytics_mode` it forwards to
// Umami Cloud (default), stores locally (self_hosted), or does both (dual).
import {
  defineEventHandler,
  readBody,
  getRequestHeader,
  createError,
} from "h3";

import { resolveUmamiConfig } from "../utils/umami-config";
import { collectHit } from "../engine/collector";
import { applyCollectCors } from "../engine/cors";
import { forwardsToUmami, resolveEngineConfig, storesLocally } from "../engine/config";
import { createExclusionMatcher } from "../engine/exclusions";

const forwardToUmami = async (event: any, payload: Record<string, any>) => {
  const runtimeConfig = useRuntimeConfig();
  const umamiBase = runtimeConfig.analytics?.umami?.proxyHost;
  const { excludedPaths, websiteId } = await resolveUmamiConfig(runtimeConfig);
  const isExcludedPath = createExclusionMatcher(excludedPaths);

  if (!umamiBase) {
    throw createError({
      statusCode: 500,
      statusMessage: "Missing runtimeConfig.analytics.umami.proxyHost",
    });
  }

  const normalizedPayload = { ...payload, website: websiteId };

  // handle exclusions
  const pathForExclusion =
    typeof normalizedPayload.pathname === "string" &&
    normalizedPayload.pathname.length > 0
      ? normalizedPayload.pathname
      : normalizedPayload.url;

  if (pathForExclusion && isExcludedPath(pathForExclusion)) {
    // still return success to not give away that the route is ignored
    return;
  }

  // Preserve client signals
  const ua = getRequestHeader(event, "user-agent") || "unknown";
  const acceptLang = getRequestHeader(event, "accept-language") || undefined;

  // Best-effort client IP extraction (Cloudflare / common proxies / generic)
  const cfIp = getRequestHeader(event, "cf-connecting-ip");
  const xRealIp = getRequestHeader(event, "x-real-ip");
  const xff = getRequestHeader(event, "x-forwarded-for");
  const xffFirst = xff ? xff.split(",")[0].trim() : undefined;
  const clientIp = cfIp || xRealIp || xffFirst;

  const res = await fetch(new URL("/api/send", umamiBase).toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": ua,
      ...(acceptLang ? { "Accept-Language": acceptLang } : {}),
      ...(clientIp ? { "X-Forwarded-For": clientIp } : {}),
    },
    body: JSON.stringify({ type: "event", payload: normalizedPayload }),
  });

  const text = await res.text();

  if (!res.ok) {
    throw createError({
      statusCode: 502,
      statusMessage: `Upstream Umami error`,
      data: { status: res.status, body: text },
    });
  }
};

export default defineEventHandler(async (event) => {
  const engine = await resolveEngineConfig(useRuntimeConfig());
  if (storesLocally(engine)) {
    await applyCollectCors(event, engine);
  }

  // The standalone tracker sends text/plain (no CORS preflight); parse it too.
  let body = await readBody(event).catch(() => null);
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      body = null;
    }
  }
  if (!body || typeof body !== "object") {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid payload: expected JSON body",
    });
  }

  const { payload } = body as {
    payload?: Record<string, any>;
  };

  if (!payload || typeof payload !== "object") {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid payload: payload object is required",
    });
  }

  if (storesLocally(engine)) {
    try {
      await collectHit(event, body, engine);
    } catch (error) {
      console.error("[analytics] local collection failed:", error);
    }
  }

  if (engine.mode === "umami_cloud") {
    await forwardToUmami(event, payload);
  } else if (forwardsToUmami(engine)) {
    // dual: local storage is authoritative, Umami Cloud is best-effort.
    await forwardToUmami(event, payload).catch((error) => {
      console.warn("[analytics] dual-mode Umami forward failed:", error?.statusMessage ?? error);
    });
  }

  return { ok: true };
});
