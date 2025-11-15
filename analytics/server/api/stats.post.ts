// Currently working only with Umami
// could be extended to support other analytics providers
//
import {
  defineEventHandler,
  readBody,
  getRequestHeader,
  createError,
} from "h3";

function normalizeExcludedPaths(
  value: string | string[] | undefined,
): string[] {
  if (!value) {
    return [];
  }

  const list = Array.isArray(value)
    ? value
    : value.split(",").map((entry) => entry.trim());

  return list.filter((entry) => entry.length > 0);
}

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
  const websiteId = runtimeConfig.analytics?.umami?.websiteId;
  const excludedPaths = normalizeExcludedPaths(
    runtimeConfig.analytics?.umami?.excludedPaths,
  );
  const isExcludedPath = createExclusionMatcher(excludedPaths);

  if (!umamiBase) {
    throw createError({
      statusCode: 500,
      statusMessage: "Missing runtimeConfig.umamiBase",
    });
  }

  const body = await readBody(event).catch(() => null);
  if (!body || typeof body !== "object") {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid payload: expected JSON body",
    });
  }

  const { type, payload } = body as {
    type?: string;
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
  if (!normalizedPayload.website) {
    throw createError({
      statusCode: 500,
      statusMessage: "Analytics websiteId missing",
    });
  }

  const pathForExclusion =
    typeof normalizedPayload.pathname === "string" &&
    normalizedPayload.pathname.length > 0
      ? normalizedPayload.pathname
      : normalizedPayload.url;

  if (pathForExclusion && isExcludedPath(pathForExclusion)) {
    // still return success to not give away that the route is ignored
    return { ok: true };
  }

  if (!type || !["event", "pageview"].includes(type)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid payload: unsupported type",
    });
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
  console.log("Sending payload from backend", clientIp, normalizedPayload);

  const res = await fetch(new URL("/api/send", umamiBase).toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": ua,
      ...(acceptLang ? { "Accept-Language": acceptLang } : {}),
      ...(clientIp ? { "X-Forwarded-For": clientIp } : {}),
    },
    body: JSON.stringify({ type, payload: normalizedPayload }),
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
