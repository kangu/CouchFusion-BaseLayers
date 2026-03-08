// Currently working only with Umami
// could be extended to support other analytics providers
//
import {
  defineEventHandler,
  readBody,
  getRequestHeader,
  createError,
} from "h3";
import { basename } from "node:path";

const DEFAULT_COUCHDB_URL = "http://localhost:5984";

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

function parseConfigString(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed === "string" && parsed.trim()) {
        return parsed.trim();
      }
    } catch {
      return trimmed.slice(1, -1).trim() || null;
    }
  }

  return trimmed;
}

function normalizeSlug(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function resolveAnalyticsSection(runtimeConfig: Record<string, any>): string {
  const explicitSlug = normalizeSlug(
    runtimeConfig.analytics?.umami?.couchEnvSlug ??
      runtimeConfig.public?.analytics?.umami?.couchEnvSlug,
  );

  if (explicitSlug) {
    return `cf_env_${explicitSlug}`;
  }

  const fallbackSlug = normalizeSlug(basename(process.cwd()));
  if (!fallbackSlug) {
    return "";
  }

  return `cf_env_${fallbackSlug}`;
}

async function readCouchConfigValue(
  section: string,
  key: string,
): Promise<string | null> {
  if (!section || !key) {
    return null;
  }

  const baseUrl = (process.env.COUCHDB_URL || DEFAULT_COUCHDB_URL).replace(
    /\/+$/,
    "",
  );
  const url = `${baseUrl}/_node/_local/_config/${encodeURIComponent(section)}/${encodeURIComponent(key)}`;
  const auth = process.env.COUCHDB_ADMIN_AUTH;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: auth ? { Authorization: `Basic ${auth}` } : undefined,
    });

    if (!response.ok) {
      return null;
    }

    const raw = await response.text();
    return parseConfigString(raw);
  } catch (error) {
    console.warn(
      `[analytics] failed to read CouchDB _config ${section}.${key}`,
      error,
    );
    return null;
  }
}

async function resolveAnalyticsCouchConfig(runtimeConfig: Record<string, any>) {
  const section = resolveAnalyticsSection(runtimeConfig);
  if (!section) {
    return {};
  }

  const [websiteId, publicWebsiteId, excludedPaths] = await Promise.all([
    readCouchConfigValue(section, "UMAMI_WEBSITE_ID"),
    readCouchConfigValue(section, "NUXT_PUBLIC_UMAMI_WEBSITE_ID"),
    readCouchConfigValue(section, "NUXT_PUBLIC_UMAMI_EXCLUDED_PATHS"),
  ]);

  return {
    websiteId: websiteId || publicWebsiteId || undefined,
    excludedPaths: excludedPaths || undefined,
  };
}

export default defineEventHandler(async (event) => {
  const runtimeConfig = useRuntimeConfig();
  const couchConfig = await resolveAnalyticsCouchConfig(runtimeConfig);
  const umamiBase = runtimeConfig.analytics?.umami?.proxyHost;
  const runtimeWebsiteId =
    typeof runtimeConfig.analytics?.umami?.websiteId === "string"
      ? runtimeConfig.analytics?.umami?.websiteId.trim()
      : "";
  const websiteId = runtimeWebsiteId || couchConfig.websiteId;
  const excludedPaths = normalizeExcludedPaths(
    runtimeConfig.analytics?.umami?.excludedPaths ?? couchConfig.excludedPaths,
  );
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

  const normalizedPayload =
    typeof websiteId === "string" && websiteId.length > 0
      ? { ...payload, website: websiteId }
      : { ...payload };

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

  // Preserve client signals
  const ua = getRequestHeader(event, "user-agent") || "unknown";
  const acceptLang = getRequestHeader(event, "accept-language") || undefined;

  // Best-effort client IP extraction (Cloudflare / common proxies / generic)
  const cfIp = getRequestHeader(event, "cf-connecting-ip");
  const xRealIp = getRequestHeader(event, "x-real-ip");
  const xff = getRequestHeader(event, "x-forwarded-for");
  const xffFirst = xff ? xff.split(",")[0].trim() : undefined;
  const clientIp = cfIp || xRealIp || xffFirst;
  // console.log(
  //   "Sending analytics payload from backend",
  //   umamiBase,
  //   clientIp,
  //   normalizedPayload,
  // );

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
  // console.log("Analytics result", text);

  if (!res.ok) {
    throw createError({
      statusCode: 502,
      statusMessage: `Upstream Umami error`,
      data: { status: res.status, body: text },
    });
  }

  return { ok: true };
});
