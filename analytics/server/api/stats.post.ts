// Currently working only with Umami
// could be extended to support other analytics providers
//
import {
  defineEventHandler,
  readBody,
  getRequestHeader,
  createError,
} from "h3";

import { resolveUmamiConfig } from "../utils/umami-config";

function createExclusionMatcher(patterns: string[]) {
  if (patterns.length === 0) {
    return () => false;
  }

  const normalized = patterns.map((pattern) => pattern.trim());

  return (path: string) => {
    return normalized.some((pattern) => {
      if (!pattern) return false;
      if (pattern.endsWith("*")) {
        const prefix = pattern.slice(0, -1);
        return path.startsWith(prefix);
      }
      return path === pattern;
    });
  };
}

export default defineEventHandler(async (event) => {
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

  const body = await readBody(event).catch(() => null);
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

  const normalizedPayload = { ...payload, website: websiteId };

  // handle exclusions
  const pathForExclusion =
    typeof normalizedPayload.pathname === "string" &&
    normalizedPayload.pathname.length > 0
      ? normalizedPayload.pathname
      : normalizedPayload.url;

  if (pathForExclusion && isExcludedPath(pathForExclusion)) {
    // still return success to not give away that the route is ignored
    return { ok: true };
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

  return { ok: true };
});
