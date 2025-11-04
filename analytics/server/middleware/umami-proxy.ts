import { defineEventHandler, getRequestPath, proxyRequest } from "h3";
import { useRuntimeConfig } from "#imports";

const PROXIED_PATHS = new Set(["/script.js", "/api/send"]);

export default defineEventHandler(async (event) => {
  const path = getRequestPath(event);

  if (!PROXIED_PATHS.has(path)) {
    return;
  }

  const config = useRuntimeConfig();
  const base =
    config.analytics?.umami?.proxyHost || "https://analytics.umami.is";
  const target = new URL(path, base);

  return proxyRequest(event, target.toString(), {
    fetchOptions: {
      headers: {
        host: target.host,
      },
    },
  });
});
