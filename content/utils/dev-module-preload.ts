import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { IncomingMessage, ServerResponse } from "node:http";

/**
 * Dev-only module preload for `nuxt dev`.
 *
 * In dev, Vite serves every source file as its own ES module, and the browser only learns
 * about a module's imports after it has fetched it. The builder page is 14 import levels
 * deep, so a warm load costs ~14 round trips before it can run, which hurts over a
 * high-latency link (the CouchFusion VPS over the tailnet).
 *
 * This module inlines a small script (`runtime/dev-preload/client.js`) at the top of every
 * page's <head>. The script fetches the module URLs this kind of page (keyed by the first
 * path segment) loaded last time and adds a `<link rel="modulepreload">` for each, then
 * reports what the load actually fetched once the page has settled. The list lives in
 * memory and in `<buildDir>/cache/cf-dev-preload.json`.
 *
 * Nothing about the modules changes: same URLs, source maps, HMR and stack traces. Off in
 * production builds. Opt out with `COUCHFUSION_DEV_PRELOAD=0` or
 * `runtimeConfig.content.devPreload = false`; per load with `?cf-preload=off`.
 */

export const PRELOAD_ENDPOINT_NAME = "__cf_dev_preload";
export const MAX_URLS = 5000;
export const MAX_KEYS = 50;
const MAX_URL_LENGTH = 2048;
const MAX_BODY_BYTES = 1024 * 1024;

type Environment = Record<string, string | undefined>;

export const devPreloadEnabled = (
  dev: boolean,
  configValue: unknown,
  environment: Environment,
): boolean => {
  if (!dev || configValue === false) {
    return false;
  }
  const flag = environment.COUCHFUSION_DEV_PRELOAD?.trim().toLowerCase();
  return !(flag === "0" || flag === "false" || flag === "off");
};

export const isValidKey = (key: unknown): key is string =>
  typeof key === "string" && /^[a-z0-9_.~-]{1,80}$/.test(key);

/** Keep only same-origin module paths under the assets prefix; dedupe, cap the count. */
export const sanitizeUrls = (urls: unknown, prefix: string): string[] => {
  if (!Array.isArray(urls)) {
    return [];
  }
  const endpoint = prefix + PRELOAD_ENDPOINT_NAME;
  const out = new Set<string>();
  for (const url of urls) {
    if (
      typeof url === "string" &&
      url.length <= MAX_URL_LENGTH &&
      url.startsWith(prefix) &&
      !url.startsWith(endpoint) &&
      !url.startsWith(prefix + "/") &&
      !/[\s"'<>\\`]/.test(url)
    ) {
      out.add(url);
      if (out.size >= MAX_URLS) {
        break;
      }
    }
  }
  return [...out];
};

export type PreloadStore = {
  get(key: string): string[];
  set(key: string, urls: string[]): void;
};

/** Per-key URL lists, most recently written last; optionally persisted to a JSON file. */
export const createPreloadStore = (file?: string): PreloadStore => {
  const lists = new Map<string, string[]>();
  if (file) {
    try {
      const saved = JSON.parse(readFileSync(file, "utf8"));
      for (const [key, urls] of Object.entries(saved ?? {})) {
        if (isValidKey(key) && Array.isArray(urls)) {
          lists.set(key, urls.filter((u) => typeof u === "string"));
        }
      }
    } catch {
      // no saved lists yet
    }
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  const persist = () => {
    if (!file || timer) {
      return;
    }
    timer = setTimeout(() => {
      timer = undefined;
      try {
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, JSON.stringify(Object.fromEntries(lists)));
      } catch {
        // cache only; ignore write errors
      }
    }, 1000);
    timer.unref?.();
  };
  return {
    get: (key) => lists.get(key) ?? [],
    set(key, urls) {
      lists.delete(key);
      lists.set(key, urls);
      while (lists.size > MAX_KEYS) {
        lists.delete(lists.keys().next().value as string);
      }
      persist();
    },
  };
};

type Next = (err?: unknown) => void;

const send = (res: ServerResponse, status: number, body?: unknown) => {
  res.statusCode = status;
  res.setHeader("cache-control", "no-store");
  if (body === undefined) {
    res.end();
    return;
  }
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(body));
};

const readBody = (req: IncomingMessage): Promise<string | null> =>
  new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        resolve(null);
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", () => resolve(null));
  });

/** Connect middleware: `GET|POST <prefix>__cf_dev_preload?key=<key>`. */
export const createPreloadMiddleware = (store: PreloadStore, prefix: string) => {
  const endpoint = prefix + PRELOAD_ENDPOINT_NAME;
  return async (req: IncomingMessage, res: ServerResponse, next: Next) => {
    const raw = req.url ?? "";
    const queryAt = raw.indexOf("?");
    const path = queryAt === -1 ? raw : raw.slice(0, queryAt);
    if (path !== endpoint) {
      next();
      return;
    }
    const key = new URLSearchParams(queryAt === -1 ? "" : raw.slice(queryAt + 1)).get("key");
    if (!isValidKey(key)) {
      send(res, 400, { error: "bad key" });
      return;
    }
    if (req.method === "GET") {
      send(res, 200, { urls: store.get(key) });
      return;
    }
    if (req.method !== "POST") {
      send(res, 405);
      return;
    }
    // Only the page itself may report what it loaded.
    const site = req.headers["sec-fetch-site"];
    if (site !== undefined && site !== "same-origin") {
      send(res, 403);
      return;
    }
    const body = await readBody(req);
    let parsed: { urls?: unknown } | null = null;
    try {
      parsed = body ? JSON.parse(body) : null;
    } catch {
      parsed = null;
    }
    const urls = sanitizeUrls(parsed?.urls, prefix);
    if (!urls.length) {
      send(res, 400, { error: "no urls" });
      return;
    }
    store.set(key, urls);
    send(res, 204);
  };
};

/** The inline <head> script with its options filled in. */
export const buildClientScript = (base: string, prefix: string): string => {
  const source = readFileSync(
    fileURLToPath(new URL("../runtime/dev-preload/client.js", import.meta.url)),
    "utf8",
  );
  return source.replace(
    "__CF_DEV_PRELOAD_OPTIONS__",
    JSON.stringify({ base, prefix }).replace(/</g, "\\u003c"),
  );
};

const withSlashes = (value: string) => {
  let v = value.startsWith("/") ? value : `/${value}`;
  if (!v.endsWith("/")) {
    v += "/";
  }
  return v.replace(/\/{2,}/g, "/");
};

/** Nuxt module (registered by the content layer). */
export default function devModulePreload(
  _moduleOptions: unknown,
  nuxt: any,
  environment: Environment = process.env,
) {
  const configValue = nuxt.options.runtimeConfig?.content?.devPreload;
  if (!devPreloadEnabled(Boolean(nuxt.options.dev), configValue, environment)) {
    return;
  }

  const base = withSlashes(nuxt.options.app?.baseURL || "/");
  const prefix = withSlashes(base + (nuxt.options.app?.buildAssetsDir || "/_nuxt/"));
  const store = createPreloadStore(join(nuxt.options.buildDir, "cache", "cf-dev-preload.json"));
  const middleware = createPreloadMiddleware(store, prefix);

  nuxt.options.app.head ||= {};
  nuxt.options.app.head.script ||= [];
  nuxt.options.app.head.script.unshift({
    key: "cf-dev-preload",
    innerHTML: buildClientScript(base, prefix),
    tagPriority: "critical",
  });

  nuxt.hook("vite:extendConfig", (config: any, context?: { isClient?: boolean }) => {
    if (context && context.isClient === false) {
      return;
    }
    config.plugins ||= [];
    config.plugins.push({
      name: "couchfusion:dev-module-preload",
      apply: "serve",
      configureServer(server: { middlewares: { use: (fn: unknown) => void } }) {
        server.middlewares.use(middleware);
      },
    });
  });
}
