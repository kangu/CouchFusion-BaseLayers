/**
 * CORS for the public collection endpoint: echoes the Origin only when it
 * belongs to a registered site's domains (or the request is same-origin).
 */
import { getRequestHeader, setResponseHeaders, type H3Event } from "h3";
import type { EngineConfig } from "./config";
import { listSites } from "./sites";

export const applyCollectCors = async (event: H3Event, config: EngineConfig): Promise<void> => {
  const origin = getRequestHeader(event, "origin");
  if (!origin) return;
  let host: string;
  try {
    host = new URL(origin).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return;
  }
  const sites = await listSites(config).catch(() => []);
  const allowed = sites.some((site) =>
    site.domains.some((domain) => host === domain || host.endsWith(`.${domain}`)),
  );
  if (!allowed) return;
  setResponseHeaders(event, {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  });
};
