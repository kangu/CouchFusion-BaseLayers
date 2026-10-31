import { EventEmitter } from "node:events";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import devModulePreload, {
  MAX_KEYS,
  buildClientScript,
  createPreloadMiddleware,
  createPreloadStore,
  devPreloadEnabled,
  sanitizeUrls,
} from "../../utils/dev-module-preload";

const prefix = "/_nuxt/";

const fakeReq = (method: string, url: string, body?: string, headers: Record<string, string> = {}) => {
  const req = new EventEmitter() as any;
  req.method = method;
  req.url = url;
  req.headers = headers;
  req.destroy = () => {};
  queueMicrotask(() => {
    if (body !== undefined) req.emit("data", Buffer.from(body));
    req.emit("end");
  });
  return req;
};

const fakeRes = () => {
  const res: any = { statusCode: 0, headers: {} as Record<string, string>, body: "" };
  res.setHeader = (k: string, v: string) => (res.headers[k] = v);
  res.end = (b?: string) => (res.body = b ?? "");
  return res;
};

describe("devPreloadEnabled", () => {
  it("is on in dev only, with opt-outs", () => {
    expect(devPreloadEnabled(true, undefined, {})).toBe(true);
    expect(devPreloadEnabled(false, undefined, {})).toBe(false);
    expect(devPreloadEnabled(true, false, {})).toBe(false);
    expect(devPreloadEnabled(true, undefined, { COUCHFUSION_DEV_PRELOAD: "0" })).toBe(false);
    expect(devPreloadEnabled(true, undefined, { COUCHFUSION_DEV_PRELOAD: "off" })).toBe(false);
  });
});

describe("sanitizeUrls", () => {
  it("keeps module paths under the prefix only", () => {
    expect(
      sanitizeUrls(
        [
          "/_nuxt/app.vue",
          "/_nuxt/node_modules/.cache/vite/client/deps/x.js?v=1",
          "/_nuxt/app.vue",
          "https://evil.example/x.js",
          "/other/x.js",
          "/_nuxt/__cf_dev_preload?key=x",
          '/_nuxt/a"onload=x',
          "/_nuxt//evil.example/x.js",
          42,
        ],
        prefix,
      ),
    ).toEqual(["/_nuxt/app.vue", "/_nuxt/node_modules/.cache/vite/client/deps/x.js?v=1"]);
    expect(sanitizeUrls("nope", prefix)).toEqual([]);
  });
});

describe("store", () => {
  it("evicts the oldest key and persists to disk", async () => {
    vi.useFakeTimers();
    const file = join(mkdtempSync(join(tmpdir(), "cf-preload-")), "cache", "list.json");
    const store = createPreloadStore(file);
    for (let i = 0; i <= MAX_KEYS; i++) store.set(`k${i}`, [`/_nuxt/${i}.js`]);
    expect(store.get("k0")).toEqual([]);
    expect(store.get(`k${MAX_KEYS}`)).toEqual([`/_nuxt/${MAX_KEYS}.js`]);
    vi.advanceTimersByTime(1100);
    vi.useRealTimers();
    const saved = JSON.parse(readFileSync(file, "utf8"));
    expect(saved.k1).toEqual(["/_nuxt/1.js"]);
    expect(createPreloadStore(file).get("k1")).toEqual(["/_nuxt/1.js"]);
  });
});

describe("middleware", () => {
  const run = async (req: any) => {
    const store = createPreloadStore();
    const mw = createPreloadMiddleware(store, prefix);
    const res = fakeRes();
    const next = vi.fn();
    await mw(req, res, next);
    return { store, mw, res, next };
  };

  it("passes other paths on", async () => {
    const { next } = await run(fakeReq("GET", "/_nuxt/app.vue"));
    expect(next).toHaveBeenCalled();
  });

  it("stores a POSTed list and returns it", async () => {
    const store = createPreloadStore();
    const mw = createPreloadMiddleware(store, prefix);
    const post = fakeRes();
    await mw(
      fakeReq("POST", "/_nuxt/__cf_dev_preload?key=builder", JSON.stringify({ urls: ["/_nuxt/a.js", "/x"] }), {
        "sec-fetch-site": "same-origin",
      }),
      post,
      vi.fn(),
    );
    expect(post.statusCode).toBe(204);
    const get = fakeRes();
    await mw(fakeReq("GET", "/_nuxt/__cf_dev_preload?key=builder"), get, vi.fn());
    expect(get.statusCode).toBe(200);
    expect(get.headers["cache-control"]).toBe("no-store");
    expect(JSON.parse(get.body)).toEqual({ urls: ["/_nuxt/a.js"] });
  });

  it("rejects bad keys, cross-site posts and empty lists", async () => {
    expect((await run(fakeReq("GET", "/_nuxt/__cf_dev_preload?key=../x"))).res.statusCode).toBe(400);
    const cross = await run(
      fakeReq("POST", "/_nuxt/__cf_dev_preload?key=a", JSON.stringify({ urls: ["/_nuxt/a.js"] }), {
        "sec-fetch-site": "cross-site",
      }),
    );
    expect(cross.res.statusCode).toBe(403);
    expect(cross.store.get("a")).toEqual([]);
    const empty = await run(fakeReq("POST", "/_nuxt/__cf_dev_preload?key=a", "{}"));
    expect(empty.res.statusCode).toBe(400);
  });
});

describe("module", () => {
  const fakeNuxt = (dev: boolean) => {
    const hooks: Record<string, Function> = {};
    return {
      hooks,
      options: {
        dev,
        buildDir: mkdtempSync(join(tmpdir(), "cf-preload-build-")),
        app: { baseURL: "/", buildAssetsDir: "/_nuxt/", head: { script: [] as any[] } },
        runtimeConfig: { content: {} },
      },
      hook: (name: string, fn: Function) => (hooks[name] = fn),
    };
  };

  it("adds the head script and the client Vite plugin in dev", () => {
    const nuxt = fakeNuxt(true);
    devModulePreload({}, nuxt, {});
    const script = nuxt.options.app.head.script[0];
    expect(script.key).toBe("cf-dev-preload");
    expect(script.innerHTML).toContain('{"base":"/","prefix":"/_nuxt/"}');
    expect(script.innerHTML).not.toContain("__CF_DEV_PRELOAD_OPTIONS__");
    const client: any = {};
    nuxt.hooks["vite:extendConfig"](client, { isClient: true });
    expect(client.plugins[0].name).toBe("couchfusion:dev-module-preload");
    const ssr: any = {};
    nuxt.hooks["vite:extendConfig"](ssr, { isClient: false });
    expect(ssr.plugins).toBeUndefined();
  });

  it("does nothing outside dev", () => {
    const nuxt = fakeNuxt(false);
    devModulePreload({}, nuxt, {});
    expect(nuxt.options.app.head.script).toEqual([]);
    expect(nuxt.hooks["vite:extendConfig"]).toBeUndefined();
  });

  it("client script parses", () => {
    expect(() => new Function(buildClientScript("/", prefix))).not.toThrow();
  });
});
