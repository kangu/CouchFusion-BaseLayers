import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";
import { createEvent } from "h3";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// --- In-memory CouchDB stand-in --------------------------------------------------

const store = new Map<string, Record<string, any>>();
const tombstones = new Map<string, string>();
let revCounter = 100;
const nextRev = (id: string) => {
  const current = store.get(id)?._rev ?? tombstones.get(id) ?? "0-x";
  const generation = Number.parseInt(current.split("-")[0], 10) + 1;
  revCounter += 1;
  return `${generation}-r${revCounter}`;
};
const putDoc = (doc: Record<string, any>) => {
  const rev = nextRev(doc._id);
  tombstones.delete(doc._id);
  store.set(doc._id, { ...structuredClone(doc), _rev: rev });
  return rev;
};
const deleteDoc = (id: string) => {
  const rev = nextRev(id);
  store.delete(id);
  tombstones.set(id, rev);
};

const getAllDocs = vi.fn(async (_db: string, params: any) => {
  if (Array.isArray(params?.keys)) {
    return {
      rows: params.keys.map((key: string) => {
        const doc = store.get(key);
        if (doc) {
          return { id: key, key, value: { rev: doc._rev }, doc: structuredClone(doc) };
        }
        if (tombstones.has(key)) {
          return { id: key, key, value: { rev: tombstones.get(key), deleted: true }, doc: null };
        }
        return { key, error: "not_found" };
      }),
    };
  }
  const rows = Array.from(store.values())
    .filter((doc) => doc._id >= params.startkey && doc._id <= params.endkey)
    .sort((a, b) => (a._id < b._id ? -1 : 1))
    .map((doc) => ({ id: doc._id, key: doc._id, value: { rev: doc._rev }, doc: structuredClone(doc) }));
  return { rows };
});

vi.mock("#database/utils/couchdb", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getAllDocs: (...args: any[]) => getAllDocs(...(args as [string, any])),
}));

const i18n = { enabled: true, defaultLocale: "en", locales: ["en", "ro"], prefixedLocales: ["ro"] };
vi.mock("../../server/utils/content-i18n-settings", () => ({
  getEffectiveContentI18nConfig: async () => ({ runtime: i18n, override: null, effective: i18n }),
}));

let globalEntries: any[] = [];
vi.mock("../../server/utils/global-components-settings", () => ({
  getEffectiveGlobalComponentEntries: async () => globalEntries,
}));

vi.mock("../../server/utils/database", () => ({
  getContentDatabaseName: () => "test-content",
}));

const calls: string[] = [];
const saveLocalizedPageDocument = vi.fn(async (payload: any, options: any) => {
  const locale = payload.locale;
  const path = payload.document.path;
  const id = locale === "en" ? `page-${path}` : `page-${path}::${locale}`;
  calls.push(`${options?.isCreate ? "create" : "save"} ${path} ${locale}`);
  if (options?.isCreate && store.has(id)) {
    throw Object.assign(new Error("Page already exists"), { statusCode: 409, statusMessage: "Page already exists" });
  }
  const base = store.get(id) ?? store.get(`page-${path}`) ?? { type: "page", meta: {} };
  const next = { ...structuredClone(base), _id: id, ...structuredClone(payload.document) };
  if (payload.document.seo) {
    next.seo = { ...(base.seo ?? {}), ...payload.document.seo };
  }
  putDoc(next);
  return { page: store.get(id) };
});
vi.mock("../../server/utils/content-pages-save", () => ({
  saveLocalizedPageDocument: (payload: any, options: any) => saveLocalizedPageDocument(payload, options),
}));

const renameContentPageUrl = vi.fn(async (input: any) => {
  calls.push(`move ${input.sourcePath} ${input.targetPath} ${input.keepRedirect}`);
  for (const locale of ["en", "ro"]) {
    const sourceId = locale === "en" ? `page-${input.sourcePath}` : `page-${input.sourcePath}::${locale}`;
    const targetId = locale === "en" ? `page-${input.targetPath}` : `page-${input.targetPath}::${locale}`;
    const source = store.get(sourceId);
    if (!source) continue;
    putDoc({ ...source, _id: targetId, path: input.targetPath });
    if (input.keepRedirect) {
      putDoc({ ...source, meta: { redirectTo: input.targetPath } });
    } else {
      deleteDoc(sourceId);
    }
  }
  return {};
});
vi.mock("../../server/utils/content-page-url-rename", () => ({
  renameContentPageUrl: (input: any) => renameContentPageUrl(input),
}));

const setContentPagePublicationState = vi.fn(async (input: any) => {
  calls.push(`publication ${input.path} ${input.publicationState}`);
  const doc = store.get(`page-${input.path}`)!;
  putDoc({ ...doc, publicationState: input.publicationState });
  return {};
});
vi.mock("../../server/utils/content-page-publication", () => ({
  setContentPagePublicationState: (input: any) => setContentPagePublicationState(input),
}));

// --- Registry manifest -------------------------------------------------------------

const runtimeConfig: any = { content: {} };
(globalThis as any).useRuntimeConfig = () => runtimeConfig;

let manifestDir = "";
beforeAll(async () => {
  manifestDir = await mkdtemp(join(tmpdir(), "cf-control-pages-"));
  const manifest = join(manifestDir, "component-definitions.json");
  await writeFile(
    manifest,
    JSON.stringify({
      version: 1,
      components: [
        { id: "hero-banner", source: "app/components/content/HeroBanner.vue" },
        { id: "text-block", source: "app/components/content/TextBlock.vue" },
        { id: "pricing-table", source: "app/components/content/PricingTable.vue" },
      ],
    }),
  );
  runtimeConfig.content.controlPlaneRegistryManifests = [join(manifestDir, "missing.json"), manifest];
});
afterAll(async () => {
  await rm(manifestDir, { recursive: true, force: true });
});

// --- Fixtures ------------------------------------------------------------------------

const body = (...value: any[]) => ({ type: "minimal", value });
const page = (path: string, extra: Record<string, any> = {}, locale = "en") => {
  const id = locale === "en" ? `page-${path}` : `page-${path}::${locale}`;
  return {
    _id: id,
    type: "page",
    path: locale === "en" ? path : `/${locale}${path}`,
    title: `Title ${path}`,
    seo: { title: `SEO ${path}`, description: `Desc ${path}`, image: null },
    layout: { spacing: "none" },
    body: body(["hero-banner", { title: "Hi" }], ["text-block", {}, ["p", {}, "Text"]]),
    publicationState: "published",
    updatedAt: "2026-11-01T10:00:00.000Z",
    meta: locale === "en" ? {} : { contentI18n: { locale, basePath: path, masterId: `page-${path}` } },
    ...extra,
  };
};

const seed = () => {
  store.clear();
  tombstones.clear();
  calls.length = 0;
  globalEntries = [{ id: "SiteFooter", component: "text-block", enabled: true, defaultProps: {} }];
  for (const doc of [
    page("/about"),
    page("/about", { title: "Despre" }, "ro"),
    page("/pricing", { body: body(["pricing-table", {}], ["HeroBanner", {}]) }),
    page("/old"),
    page("/legacy", { body: body(["retired-widget", {}]) }),
    page("/gone", { title: null, body: body(), meta: { redirectTo: "/about" } }),
    page("/draft", { publicationState: "draft" }),
    { _id: "oldpage-/about-2026", type: "page", path: "/about", title: "History" },
    { _id: "_design/content", views: {} },
  ]) {
    putDoc(doc);
  }
};

const revOf = (id: string) => store.get(id)!._rev as string;

const ops = async () => import("../../server/utils/control-page-operations");

beforeEach(() => {
  seed();
  saveLocalizedPageDocument.mockClear();
  renameContentPageUrl.mockClear();
  setContentPagePublicationState.mockClear();
});

// --- h3 event helper -----------------------------------------------------------------

const makeEvent = (options: { method?: string; url: string; body?: unknown; token?: string }) => {
  const socket = new Socket();
  const req = new IncomingMessage(socket);
  req.method = options.method ?? "GET";
  req.url = options.url;
  req.headers = options.token ? { "x-couchfusion-control-token": options.token } : {};
  if (options.body !== undefined) {
    req.headers["content-type"] = "application/json";
    (req as any).body = JSON.stringify(options.body);
  }
  const res = new ServerResponse(req);
  const event = createEvent(req, res);
  event.context = {};
  return event;
};

// --- Tests ---------------------------------------------------------------------------

describe("control page routes: token gating", () => {
  const handlers = [
    ["pages.get", "GET", "/__couchfusion/control/pages"],
    ["page-documents.get", "GET", "/__couchfusion/control/page-documents?all=1"],
    ["pages-check.post", "POST", "/__couchfusion/control/pages/check"],
    ["pages-apply.post", "POST", "/__couchfusion/control/pages/apply"],
  ] as const;

  beforeEach(() => {
    process.env.COUCHFUSION_CONTROL_TOKEN = "secret-token";
  });

  it.each(handlers)("%s answers 404 without or with a wrong token and writes nothing", async (file, method, url) => {
    const handler = (await import(`../../runtime/control-plane/${file}.ts`)).default;
    const body = method === "POST" ? { operations: [{ op: "page.publication", path: "/about", state: "draft" }], baseRevs: {} } : undefined;
    await expect(handler(makeEvent({ method, url, body }))).rejects.toMatchObject({ statusCode: 404 });
    await expect(handler(makeEvent({ method, url, body, token: "wrong" }))).rejects.toMatchObject({ statusCode: 404 });
    expect(getAllDocs).not.toHaveBeenCalledWith("test-content", expect.anything());
    expect(calls).toEqual([]);
    getAllDocs.mockClear();
  });

  it("serves the pages list with the token", async () => {
    const handler = (await import("../../runtime/control-plane/pages.get.ts")).default;
    const event = makeEvent({ url: "/__couchfusion/control/pages", token: "secret-token" });
    const response = await handler(event);
    expect(event.node.res.getHeader("cache-control")).toBe("no-store");
    expect(response.defaultLocale).toBe("en");
    expect(response.pages.map((entry: any) => entry.path)).toEqual(["/about", "/draft", "/gone", "/legacy", "/old", "/pricing"]);
  });

  it("apply answers 409 with problems and writes nothing", async () => {
    const handler = (await import("../../runtime/control-plane/pages-apply.post.ts")).default;
    const event = makeEvent({
      method: "POST",
      url: "/__couchfusion/control/pages/apply",
      token: "secret-token",
      body: { operations: [{ op: "page.publication", path: "/about", state: "draft" }, { op: "page.delete", path: "/about" }], baseRevs: {} },
    });
    const response = await handler(event);
    expect(event.node.res.statusCode).toBe(409);
    expect(response).toEqual({ ok: false, problems: [{ index: 1, message: 'Unknown operation "page.delete"' }] });
    expect(calls).toEqual([]);
  });

  it("rejects malformed request bodies with 400", async () => {
    const handler = (await import("../../runtime/control-plane/pages-check.post.ts")).default;
    const event = makeEvent({ method: "POST", url: "/__couchfusion/control/pages/check", token: "secret-token", body: { operations: "nope" } });
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 400 });
    const tooMany = makeEvent({
      method: "POST",
      url: "/__couchfusion/control/pages/check",
      token: "secret-token",
      body: { operations: Array.from({ length: 51 }, () => ({ op: "page.publication", path: "/about", state: "draft" })) },
    });
    await expect(handler(tooMany)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("page-documents needs path= or all=1", async () => {
    const handler = (await import("../../runtime/control-plane/page-documents.get.ts")).default;
    await expect(handler(makeEvent({ url: "/__couchfusion/control/page-documents", token: "secret-token" }))).rejects.toMatchObject({ statusCode: 400 });
    const response = await handler(makeEvent({ url: "/__couchfusion/control/page-documents?path=/about&path=/nope", token: "secret-token" }));
    expect(response.pages.map((entry: any) => [entry.path, entry.documents.length])).toEqual([["/about", 2], ["/nope", 0]]);
  });
});

describe("listing pages and documents", () => {
  it("lists current pages only, with locales, redirects and publication state", async () => {
    const { listControlPages } = await ops();
    const result = await listControlPages();
    expect(result.locales).toEqual(["en", "ro"]);
    expect(result.pages.find((entry) => entry.path === "/about")).toEqual({
      path: "/about",
      title: "Title /about",
      publicationState: "published",
      locales: ["en", "ro"],
      redirect: null,
      updatedAt: "2026-11-01T10:00:00.000Z",
    });
    expect(result.pages.find((entry) => entry.path === "/gone")?.redirect).toEqual({ to: "/about", status: 308 });
    expect(result.pages.find((entry) => entry.path === "/draft")?.publicationState).toBe("draft");
    expect(result.pages.every((entry) => entry.title !== "History")).toBe(true);
  });

  it("returns every locale document with id, rev, seo, layout and body", async () => {
    const { getControlPageDocuments } = await ops();
    const result = await getControlPageDocuments({ paths: ["/about"], all: false });
    expect(result.pages[0].documents).toEqual([
      expect.objectContaining({ locale: "en", id: "page-/about", rev: revOf("page-/about"), title: "Title /about", seo: { title: "SEO /about", description: "Desc /about", image: null }, publicationState: "published", layout: { spacing: "none" } }),
      expect.objectContaining({ locale: "ro", id: "page-/about::ro", rev: revOf("page-/about::ro"), title: "Despre" }),
    ]);
    expect(result.pages[0].documents[0].body).toEqual(page("/about").body);
    const all = await getControlPageDocuments({ paths: [], all: true });
    expect(all.pages).toHaveLength(6);
  });
});

describe("check problems", () => {
  const check = async (operations: unknown[], baseRevs: Record<string, string> = {}) => {
    const { checkPageOperations } = await ops();
    return checkPageOperations({ operations, baseRevs });
  };

  it("reports unknown operations and fields", async () => {
    const result = await check([{ op: "page.delete", path: "/about" }, { op: "page.update", path: "/about", title: "X", description: "y" }, "nope"]);
    expect(result.ok).toBe(false);
    expect(result.problems).toEqual([
      { index: 0, message: 'Unknown operation "page.delete"' },
      { index: 1, message: 'Unknown field "description" for page.update' },
      { index: 2, message: "Operation must be an object" },
    ]);
  });

  it("reports missing pages and invalid fields", async () => {
    const result = await check([
      { op: "page.update", path: "/missing", title: "X" },
      { op: "page.update", path: "/about" },
      { op: "page.update", path: "/about", locale: "de", title: "X" },
      { op: "page.update", path: "/ro/about", title: "X" },
      { op: "page.publication", path: "/about", state: "archived" },
      { op: "page.update", path: "/about", body: { type: "minimal", value: [[42]] } },
    ]);
    expect(result.problems.map((problem) => [problem.index, problem.message])).toEqual([
      [0, "Page /missing not found"],
      [1, "page.update needs at least one of title, seo, body, layout"],
      [2, 'Unknown locale "de" (locales: en, ro)'],
      [3, 'path /ro/about includes the locale prefix "ro"; use the base path /about'],
      [4, 'state must be "published" or "draft"'],
      [5, "Invalid tag at value[0]"],
    ]);
  });

  it("flags unknown components but allows registry ids, aliases, HTML, primitives and globals", async () => {
    const result = await check([
      {
        op: "page.update",
        path: "/about",
        body: body(
          ["HeroBanner", {}],
          ["pricing-table", {}],
          ["PricingTabel", {}],
          ["div", {}, ["img", { src: "/x.png" }], ["strong", {}, "x"], ["template", { slot: "title" }, ["h1", {}, "T"]]],
          ["SiteFooter", {}],
          ["section", {}, ["mystery-box", {}]],
        ),
      },
    ]);
    expect(result.problems).toEqual([
      { index: 0, message: "Unknown component PricingTabel in body" },
      { index: 0, message: "Unknown component mystery-box in body" },
    ]);
  });

  it("tolerates unknown components that the page already uses", async () => {
    const result = await check([{ op: "page.update", path: "/legacy", body: body(["retired-widget", {}], ["p", {}, "More"]) }]);
    expect(result.ok).toBe(true);
  });

  it("fails closed when the registry manifest is missing", async () => {
    const saved = runtimeConfig.content.controlPlaneRegistryManifests;
    runtimeConfig.content.controlPlaneRegistryManifests = [join(manifestDir, "missing.json")];
    const cwd = vi.spyOn(process, "cwd").mockReturnValue(manifestDir);
    try {
      const result = await check([{ op: "page.update", path: "/about", body: body(["pricing-table", {}], ["p", {}, "ok"]) }]);
      expect(result.problems[0].message).toMatch(/Unknown component pricing-table in body \(component registry .* not found/);
    } finally {
      cwd.mockRestore();
      runtimeConfig.content.controlPlaneRegistryManifests = saved;
    }
  });

  it("rejects bodies over 1 MB", async () => {
    const result = await check([{ op: "page.update", path: "/about", body: body(["p", {}, "x".repeat(1_000_100)]) }]);
    expect(result.problems).toEqual([{ index: 0, message: "Body is larger than 1 MB" }]);
  });

  it("reports documents whose rev changed since the request ran", async () => {
    const result = await check(
      [
        { op: "page.update", path: "/about", title: "About us" },
        { op: "page.publication", path: "/pricing", state: "draft" },
      ],
      { "page-/about": "1-stale", "page-/pricing": revOf("page-/pricing") },
    );
    expect(result.problems).toEqual([{ index: 0, message: "Page /about (en) changed since the request ran." }]);
    expect(result.preview).toHaveLength(2);
  });

  it("checks every locale document when a body is written", async () => {
    const result = await check([{ op: "page.update", path: "/about", body: body(["p", {}, "New"]) }], {
      "page-/about": revOf("page-/about"),
      "page-/about::ro": "3-stale",
    });
    expect(result.problems).toEqual([{ index: 0, message: "Page /about (ro) changed since the request ran." }]);
  });

  it("reports a move whose target exists, a redirect source and the home page", async () => {
    const result = await check([
      { op: "page.move", from: "/old", to: "/about", keepRedirect: true },
      { op: "page.move", from: "/gone", to: "/elsewhere", keepRedirect: false },
      { op: "page.move", from: "/", to: "/home", keepRedirect: false },
      { op: "page.move", from: "/old", to: "/api/x", keepRedirect: false },
      { op: "page.move", from: "/old", to: "/new" },
    ]);
    expect(result.problems.map((problem) => [problem.index, problem.message])).toEqual([
      [0, "Target /about already exists"],
      [1, "Page /gone is a redirect and cannot be moved"],
      [2, "The home page cannot be moved"],
      [3, "/api/x is not a valid content page path"],
      [4, "keepRedirect must be true or false"],
    ]);
  });

  it("reports copyContent from a redirect or a missing page", async () => {
    const result = await check([
      { op: "page.copyContent", from: "/gone", to: "/about" },
      { op: "page.copyContent", from: "/about", to: "/nowhere" },
      { op: "page.copyContent", from: "/about", to: "/gone" },
    ]);
    expect(result.problems).toEqual([
      { index: 0, message: "Page /gone is a redirect to /about; copy from that page instead" },
      { index: 1, message: "Page /nowhere not found" },
      { index: 2, message: "Page /gone is a redirect to /about; its content is never shown" },
    ]);
  });

  it("reports page.create problems: existing path, invalid paths, missing fields, unknown fields", async () => {
    const result = await check([
      { op: "page.create", path: "/about", title: "Again", body: body(["p", {}, "x"]) },
      { op: "page.create", path: "/ro/new", title: "X", body: body() },
      { op: "page.create", path: "/api/thing", title: "X", body: body() },
      { op: "page.create", path: "/logo.png", title: "X", body: body() },
      { op: "page.create", path: "/new" },
      { op: "page.create", path: "/new", title: "X", body: body(), state: "draft", publicationState: "hidden" },
      { op: "page.create", path: "/new", title: "X", body: body(["p", {}, "x".repeat(1_000_100)]) },
      { op: "page.create", path: "/new", title: "X", body: body(), layout: { blob: "x".repeat(100_100) } },
      { op: "page.create", path: "/gone", title: "X", body: body() },
    ]);
    expect(result.problems.map((problem) => [problem.index, problem.message])).toEqual([
      [0, "Page /about already exists"],
      [1, 'path /ro/new includes the locale prefix "ro"; use the base path /new'],
      [2, "/api/thing is not a valid content page path"],
      [3, "/logo.png is not a valid content page path"],
      [4, "page.create needs a title"],
      [4, "page.create needs a body"],
      [5, 'Unknown field "state" for page.create'],
      [5, 'publicationState must be "published" or "draft"'],
      [6, "Body is larger than 1 MB"],
      [7, "layout is too large"],
      [8, "Page /gone already exists"],
    ]);
  });

  it("validates every component tag of a new page body", async () => {
    const result = await check([
      { op: "page.create", path: "/new", title: "New", body: body(["HeroBanner", {}], ["retired-widget", {}], ["div", {}, ["SiteFooter", {}]]) },
    ]);
    expect(result.problems).toEqual([{ index: 0, message: "Unknown component retired-widget in body" }]);
  });

  it("tracks created pages in the simulated state", async () => {
    const result = await check([
      { op: "page.create", path: "/new", title: "New", body: body(["p", {}, "x"]) },
      { op: "page.create", path: "/new", title: "Twice", body: body() },
      { op: "page.update", path: "/new", locale: "ro", title: "Nou" },
      { op: "page.publication", path: "/new", state: "published" },
      { op: "page.move", from: "/old", to: "/moved", keepRedirect: false },
      { op: "page.create", path: "/moved", title: "Taken", body: body() },
      { op: "page.create", path: "/old", title: "Reused", body: body() },
    ]);
    expect(result.problems).toEqual([
      { index: 1, message: "Page /new already exists" },
      { index: 5, message: "Page /moved already exists" },
    ]);
    expect(result.preview.find((entry) => entry.index === 3)?.changes).toEqual([
      { field: "publicationState", before: "draft", after: "published" },
    ]);
  });

  it("validates later operations against the effect of earlier ones", async () => {
    const result = await check([
      { op: "page.move", from: "/old", to: "/new", keepRedirect: false },
      { op: "page.update", path: "/new", title: "New" },
      { op: "page.update", path: "/old", title: "Old" },
      { op: "page.move", from: "/pricing", to: "/old", keepRedirect: true },
    ]);
    expect(result.problems).toEqual([{ index: 2, message: "Page /old not found" }]);
  });
});

describe("check preview", () => {
  it("describes titles, seo, publication state and body outlines", async () => {
    const { checkPageOperations } = await ops();
    const result = await checkPageOperations({
      operations: [
        {
          op: "page.update",
          path: "/about",
          title: "About us",
          seo: { description: "New description", image: "https://cdn.test/a.png" },
          body: body(["hero-banner", { title: "Hi" }], ["text-block", {}, ["p", {}, "Text"]], ["PricingTable", {}]),
        },
        { op: "page.update", path: "/about", locale: "ro", body: body(["hero-banner", { title: "Salut" }], ["text-block", {}, ["p", {}, "Text"]]) },
        { op: "page.publication", path: "/draft", state: "published" },
        { op: "page.move", from: "/old", to: "/new", keepRedirect: true },
        { op: "page.copyContent", from: "/pricing", to: "/about" },
      ],
      baseRevs: {},
    });
    expect(result.ok).toBe(true);
    expect(result.preview[0]).toEqual({
      index: 0,
      op: "page.update",
      path: "/about",
      locales: ["en"],
      changes: [
        { field: "title", before: "Title /about", after: "About us" },
        { field: "seo.description", before: "Desc /about", after: "New description" },
        { field: "seo.image", before: "(none)", after: "https://cdn.test/a.png" },
        { field: "body", before: "2 blocks: hero-banner, text-block", after: "3 blocks: hero-banner, text-block, PricingTable" },
        { field: "body.components", before: "removed: none", after: "added: PricingTable" },
      ],
    });
    expect(result.preview[1].changes).toEqual([
      { field: "body", before: "2 blocks: hero-banner, text-block", after: "2 blocks: hero-banner, text-block (content changed)" },
    ]);
    expect(result.preview[2].changes).toEqual([{ field: "publicationState", before: "draft", after: "published" }]);
    expect(result.preview[3]).toMatchObject({
      op: "page.move",
      path: "/old",
      from: "/old",
      to: "/new",
      changes: [
        { field: "path", before: "/old", after: "/new" },
        { field: "redirect", before: "none", after: "/old → /new (308)" },
      ],
    });
    // copyContent sees the body proposed by operation 0 as "before".
    expect(result.preview[4]).toMatchObject({ op: "page.copyContent", path: "/about", from: "/pricing", to: "/about", locales: ["en", "ro"] });
    expect(result.preview[4].changes[0]).toEqual({
      field: "body (en)",
      before: "3 blocks: hero-banner, text-block, PricingTable",
      after: "2 blocks: pricing-table, HeroBanner",
    });
    expect(result.preview[4].changes[1]).toEqual({ field: "body.components (en)", before: "removed: text-block", after: "added: none" });
  });

  it("describes a created page", async () => {
    const { checkPageOperations } = await ops();
    const result = await checkPageOperations({
      operations: [
        {
          op: "page.create",
          path: "/new-page",
          title: "New page",
          seo: { description: "Fresh", image: null },
          body: body(["hero-banner", {}], ["text-block", {}], ["p", {}, "a"], ["PricingTable", {}]),
          layout: { spacing: "wide" },
        },
        { op: "page.create", path: "/live", title: "Live", body: body(), publicationState: "published" },
      ],
      baseRevs: {},
    });
    expect(result.ok).toBe(true);
    expect(result.preview[0]).toEqual({
      index: 0,
      op: "page.create",
      path: "/new-page",
      locales: ["en"],
      changes: [
        { field: "path", before: null, after: "/new-page" },
        { field: "title", before: null, after: "New page" },
        { field: "seo.title", before: null, after: "New page" },
        { field: "seo.description", before: null, after: "Fresh" },
        { field: "seo.image", before: null, after: "(none)" },
        { field: "publicationState", before: null, after: "draft" },
        { field: "body", before: null, after: "4 blocks: hero-banner, text-block, p, PricingTable" },
        { field: "layout", before: null, after: '{"spacing":"wide"}' },
      ],
    });
    expect(result.preview[1].changes).toContainEqual({ field: "publicationState", before: null, after: "published" });
    expect(result.preview[1].changes).toContainEqual({ field: "body", before: null, after: "empty" });
  });

  it("truncates long strings to about 200 characters", async () => {
    const { checkPageOperations } = await ops();
    const result = await checkPageOperations({
      operations: [{ op: "page.update", path: "/about", title: "T".repeat(400) }],
      baseRevs: {},
    });
    expect(result.preview[0].changes[0].after.length).toBeLessThanOrEqual(200);
    expect(result.preview[0].changes[0].after.endsWith("…")).toBe(true);
  });
});

describe("apply", () => {
  it("applies operations in order with the layer helpers and reports written documents", async () => {
    const { applyPageOperations } = await ops();
    const result = await applyPageOperations({
      operations: [
        { op: "page.update", path: "/about", title: "About us", seo: { image: null } },
        { op: "page.move", from: "/old", to: "/new", keepRedirect: false },
        { op: "page.update", path: "/new", locale: "ro", title: "Nou" },
        { op: "page.copyContent", from: "/pricing", to: "/about" },
        { op: "page.publication", path: "/draft", state: "published" },
      ],
      baseRevs: { "page-/about": revOf("page-/about"), "page-/old": revOf("page-/old") },
    });

    expect(result.status).toBe(200);
    expect(calls).toEqual([
      "save /about en",
      "move /old /new false",
      "save /new ro",
      "save /about en",
      "save /about ro",
      "publication /draft published",
    ]);
    expect(saveLocalizedPageDocument.mock.calls[0]).toEqual([
      { document: { path: "/about", title: "About us", seo: { image: "" } }, locale: "en" },
      { isCreate: false },
    ]);
    // copyContent: /pricing has no ro document, so both /about locales get its en body.
    const pricingBody = body(["pricing-table", {}], ["HeroBanner", {}]);
    expect(saveLocalizedPageDocument.mock.calls[2][0]).toEqual({ document: { path: "/about", body: pricingBody, layout: { spacing: "none" } }, locale: "en" });
    expect(saveLocalizedPageDocument.mock.calls[3][0]).toEqual({ document: { path: "/about", body: pricingBody, layout: { spacing: "none" } }, locale: "ro" });
    expect(result.body).toMatchObject({ ok: true });
    const applied = (result.body as any).applied;
    expect(applied.map((entry: any) => [entry.index, entry.path])).toEqual([
      [0, "/about"],
      [1, "/new"],
      [2, "/new"],
      [3, "/about"],
      [4, "/draft"],
    ]);
    expect(applied[0].documents).toEqual([{ id: "page-/about", rev: expect.stringMatching(/^2-/) }]);
    expect(applied[1].documents).toEqual([
      { id: "page-/old", rev: expect.stringMatching(/^2-/), deleted: true },
      { id: "page-/new", rev: expect.stringMatching(/^1-/) },
    ]);
    expect(applied[3].documents).toEqual([
      { id: "page-/about", rev: revOf("page-/about") },
      { id: "page-/about::ro", rev: revOf("page-/about::ro") },
    ]);
    expect(applied[2].documents).toEqual([{ id: "page-/new::ro", rev: revOf("page-/new::ro") }]);
    expect(applied[4].documents).toEqual([{ id: "page-/draft", rev: revOf("page-/draft") }]);
  });

  it("creates a draft page with isCreate and lets later operations update and publish it", async () => {
    const { applyPageOperations } = await ops();
    const result = await applyPageOperations({
      operations: [
        { op: "page.create", path: "/new-page", title: "New page", seo: { title: "New SEO" }, body: body(["hero-banner", {}]) },
        { op: "page.update", path: "/new-page", locale: "ro", title: "Pagina noua" },
        { op: "page.publication", path: "/new-page", state: "published" },
      ],
      baseRevs: {},
    });
    expect(result.status).toBe(200);
    expect(calls).toEqual(["create /new-page en", "save /new-page ro", "publication /new-page published"]);
    expect(saveLocalizedPageDocument.mock.calls[0]).toEqual([
      {
        document: { path: "/new-page", title: "New page", body: body(["hero-banner", {}]), publicationState: "draft", seo: { title: "New SEO" } },
        locale: "en",
      },
      { isCreate: true },
    ]);
    expect((result.body as any).applied).toEqual([
      { index: 0, path: "/new-page", documents: [{ id: "page-/new-page", rev: expect.stringMatching(/^1-/) }] },
      { index: 1, path: "/new-page", documents: [{ id: "page-/new-page::ro", rev: revOf("page-/new-page::ro") }] },
      { index: 2, path: "/new-page", documents: [{ id: "page-/new-page", rev: revOf("page-/new-page") }] },
    ]);
  });

  it("answers 409 and writes nothing when the page to create appeared meanwhile", async () => {
    const { applyPageOperations } = await ops();
    putDoc(page("/new-page"));
    const before = new Map(Array.from(store.entries()).map(([id, doc]) => [id, doc._rev]));
    const result = await applyPageOperations({
      operations: [
        { op: "page.publication", path: "/draft", state: "published" },
        { op: "page.create", path: "/new-page", title: "New page", body: body() },
      ],
      baseRevs: {},
    });
    expect(result).toEqual({ status: 409, body: { ok: false, problems: [{ index: 1, message: "Page /new-page already exists" }] } });
    expect(calls).toEqual([]);
    expect(new Map(Array.from(store.entries()).map(([id, doc]) => [id, doc._rev]))).toEqual(before);
  });

  it("stops before writing when the page to create appears after the check", async () => {
    const { applyPageOperations } = await ops();
    setContentPagePublicationState.mockImplementationOnce(async (input: any) => {
      calls.push(`publication ${input.path} ${input.publicationState}`);
      putDoc({ ...store.get(`page-${input.path}`)!, publicationState: input.publicationState });
      putDoc(page("/new-page")); // someone creates it in the builder meanwhile
      return {};
    });
    const result = await applyPageOperations({
      operations: [
        { op: "page.publication", path: "/draft", state: "published" },
        { op: "page.create", path: "/new-page", title: "New page", body: body() },
      ],
      baseRevs: {},
    });
    expect(result.status).toBe(500);
    expect((result.body as any).failed).toEqual({ index: 1, message: "Document page-/new-page changed while applying; stopped" });
    expect(calls).toEqual(["publication /draft published"]);
    expect(store.get("page-/new-page")!.title).toBe("Title /new-page");
  });

  it("writes nothing when the check fails", async () => {
    const { applyPageOperations } = await ops();
    const before = new Map(Array.from(store.entries()).map(([id, doc]) => [id, doc._rev]));
    const result = await applyPageOperations({
      operations: [
        { op: "page.publication", path: "/about", state: "draft" },
        { op: "page.update", path: "/about", body: body(["Nope", {}]) },
      ],
      baseRevs: {},
    });
    expect(result).toEqual({ status: 409, body: { ok: false, problems: [{ index: 1, message: "Unknown component Nope in body" }] } });
    expect(calls).toEqual([]);
    expect(new Map(Array.from(store.entries()).map(([id, doc]) => [id, doc._rev]))).toEqual(before);
  });

  it("writes nothing on a rev mismatch", async () => {
    const { applyPageOperations } = await ops();
    const result = await applyPageOperations({
      operations: [{ op: "page.publication", path: "/about", state: "draft" }],
      baseRevs: { "page-/about": "1-old" },
    });
    expect(result.status).toBe(409);
    expect(calls).toEqual([]);
  });

  it("stops with 500 and the applied list when a helper fails mid-way", async () => {
    const { applyPageOperations } = await ops();
    setContentPagePublicationState.mockImplementationOnce(async () => {
      calls.push("publication failed");
      throw Object.assign(new Error("boom"), { statusCode: 500, statusMessage: "CouchDB said no" });
    });
    const result = await applyPageOperations({
      operations: [
        { op: "page.update", path: "/about", title: "About us" },
        { op: "page.publication", path: "/draft", state: "published" },
        { op: "page.update", path: "/pricing", title: "Never" },
      ],
      baseRevs: {},
    });
    expect(result.status).toBe(500);
    expect(result.body).toEqual({
      ok: false,
      applied: [{ index: 0, path: "/about", documents: [{ id: "page-/about", rev: revOf("page-/about") }] }],
      failed: { index: 1, message: "CouchDB said no" },
    });
    expect(calls).toEqual(["save /about en", "publication failed"]);
  });

  it("stops before writing when a document changed after the check", async () => {
    const { applyPageOperations } = await ops();
    // Simulate a concurrent builder save between check and the second operation.
    saveLocalizedPageDocument.mockImplementationOnce(async (payload: any) => {
      calls.push(`save ${payload.document.path} ${payload.locale}`);
      putDoc({ ...store.get("page-/about")!, title: payload.document.title });
      putDoc({ ...store.get("page-/pricing")!, title: "Edited elsewhere" });
      return {};
    });
    const result = await applyPageOperations({
      operations: [
        { op: "page.update", path: "/about", title: "About us" },
        { op: "page.update", path: "/pricing", title: "Mine" },
      ],
      baseRevs: {},
    });
    expect(result.status).toBe(500);
    expect((result.body as any).failed).toEqual({ index: 1, message: "Document page-/pricing changed while applying; stopped" });
    expect(calls).toEqual(["save /about en"]);
  });
});

describe("helpers", () => {
  it("knows registry ids, Pascal and camel aliases, HTML tags and enabled globals", async () => {
    const { isKnownComponentTag } = await ops();
    const known = {
      registryAvailable: true,
      registryTags: new Set(["hero-banner", "HeroBanner", "heroBanner"]),
      globalAliases: new Set(["SiteFooter"]),
    };
    for (const tag of ["hero-banner", "HeroBanner", "heroBanner", "SiteFooter", "p", "IMG", "template", "svg"]) {
      expect(isKnownComponentTag(tag, known)).toBe(true);
    }
    for (const tag of ["Herobanner", "site-footer", "pricing-table"]) {
      expect(isKnownComponentTag(tag, known)).toBe(false);
    }
  });

  it("ignores disabled global aliases", async () => {
    globalEntries = [{ id: "OffAlias", component: "text-block", enabled: false, defaultProps: {} }];
    const { loadKnownComponents } = await ops();
    const known = await loadKnownComponents();
    expect(known.globalAliases.has("OffAlias")).toBe(false);
    expect(known.registryTags.has("PricingTable")).toBe(true);
  });
});
