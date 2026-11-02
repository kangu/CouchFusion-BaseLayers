import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createServer, type Server } from "node:http";
import { createApp, toNodeListener } from "h3";

const tokens = new Map<string, any>();
const user = {
  _id: "org.couchdb.user:maria",
  _rev: "3-u",
  name: "maria",
  email: "Maria@Example.com",
  roles: [],
  type: "user",
  funnel: "pow_lab_lite",
  password_scheme: "pbkdf2",
  pbkdf2_prf: "sha256",
  iterations: 600000,
  derived_key: "secret-derived-key",
  salt: "secret-salt",
};

vi.mock("#database/utils/couchdb", () => ({
  getDocument: async (_db: string, id: string) => tokens.get(id) ?? null,
  putDocument: async (_db: string, doc: any) => {
    const current = tokens.get(doc._id);
    if (current?._rev !== doc._rev) throw new Error("CouchDB error: conflict");
    tokens.set(doc._id, { ...doc, _rev: `${Number(doc._rev[0]) + 1}-t` });
    return { ok: true, id: doc._id, rev: tokens.get(doc._id)._rev };
  },
  getView: async (_db: string, _ddoc: string, _view: string, { key }: { key: string }) => ({
    rows: user.email.toLowerCase() === key ? [{ id: user._id, key, value: user }] : [],
  }),
  // _all_docs over an id range, as used to cancel an email's pending codes.
  getAllDocs: async (_db: string, { startkey, endkey }: { startkey: string; endkey: string }) => ({
    rows: [...tokens.values()]
      .filter((doc) => doc._id >= startkey && doc._id <= endkey)
      .sort((a, b) => (a._id < b._id ? -1 : 1))
      .map((doc) => ({ id: doc._id, key: doc._id, value: { rev: doc._rev }, doc })),
  }),
  getSession: async () => ({ ok: true, userCtx: { name: "maria", roles: [] } }),
  generateAuthSessionCookie: (name: string) =>
    `AuthSession=${Buffer.from(`${name}:stamp:sig`).toString("base64")}; Version=1; Path=/; HttpOnly`,
}));

// The cookie secret comes from CouchDB's own config (chttpd_auth/secret), nothing else.
vi.mock("#database/utils/couch-config", async (importOriginal) => ({
  ...(await importOriginal<typeof import("#database/utils/couch-config")>()),
  readCouchConfigValue: async (section: string, key: string) =>
    section === "chttpd_auth" && key === "secret" ? "fixture-secret" : null,
}));

let server: Server;
let url = "";
beforeAll(async () => {
  (globalThis as any).useRuntimeConfig = () => ({
    dbLoginPrefix: "bv",
  });
  const handler = (await import("./login-verify.post")).default;
  const app = createApp();
  app.use(handler);
  server = createServer(toNodeListener(app));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  url = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
afterAll(() => {
  server.close();
  delete (globalThis as any).useRuntimeConfig;
});
beforeEach(async () => {
  (await import("../utils/login-limits")).resetLoginLimits();
  tokens.clear();
  tokens.set("maria@example.com--ABCDEF", {
    _id: "maria@example.com--ABCDEF",
    _rev: "1-t",
    email: "maria@example.com",
    code: "ABCDEF",
    funnel: "pow_lab_lite",
    expires: new Date(Date.now() + 60_000).toISOString(),
    used: false,
  });
});

const verify = (email: string, token: string, address = "203.0.113.10") =>
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Real-IP": address },
    body: JSON.stringify({ email, token }),
  });

const pendingCode = (email: string, code: string) => {
  tokens.set(`${email}--${code}`, {
    _id: `${email}--${code}`,
    _rev: "1-t",
    email,
    code,
    expires: new Date(Date.now() + 60_000).toISOString(),
    used: false,
  });
};

describe("POST /api/login-verify: wrong-code limits", () => {
  it("allows four wrong codes, and a right one then resets the count", async () => {
    for (const code of ["AAAAAA", "BBBBBB", "CCCCCC", "DDDDDD"]) {
      expect((await verify("maria@example.com", code)).status).toBe(404);
    }
    expect((await verify("maria@example.com", "ABCDEF")).status).toBe(200);
    // The count started over: four more misses still don't cancel anything.
    pendingCode("maria@example.com", "GHIJKL");
    for (const code of ["AAAAAA", "BBBBBB", "CCCCCC", "DDDDDD"]) {
      expect((await verify("maria@example.com", code)).status).toBe(404);
    }
    expect(tokens.get("maria@example.com--GHIJKL").used).toBe(false);
  });

  it("cancels the email's pending codes on the 5th wrong code; a new code works", async () => {
    pendingCode("maria@example.com", "UVWXYZ");
    pendingCode("other@example.com", "OTHERS");
    const statuses = [];
    for (const code of ["AAAAAA", "BBBBBB", "CCCCCC", "DDDDDD", "EEEEEE"]) {
      statuses.push((await verify("maria@example.com", code)).status);
    }
    expect(statuses).toEqual([404, 404, 404, 404, 429]);
    expect(tokens.get("maria@example.com--ABCDEF")).toMatchObject({ used: true, cancelled: "too-many-wrong-codes" });
    expect(tokens.get("maria@example.com--UVWXYZ")).toMatchObject({ used: true, cancelled: "too-many-wrong-codes" });
    // Another email's code is untouched.
    expect(tokens.get("other@example.com--OTHERS").used).toBe(false);
    // The right (old) code no longer works ...
    const late = await verify("maria@example.com", "ABCDEF");
    expect(late.status).toBe(404);
    expect(late.headers.get("set-cookie")).toBeNull();
    // ... a newly requested one does.
    pendingCode("maria@example.com", "NEWONE");
    expect((await verify("maria@example.com", "NEWONE")).status).toBe(200);
  });

  it("answers the same for an email without an account", async () => {
    const statuses = [];
    for (const code of ["AAAAAA", "BBBBBB", "CCCCCC", "DDDDDD", "EEEEEE"]) {
      statuses.push((await verify("nobody@example.com", code)).status);
    }
    expect(statuses).toEqual([404, 404, 404, 404, 429]);
  });

  it("blocks an address after 30 wrong codes across emails, even with a right code", async () => {
    for (let i = 0; i < 30; i++) {
      // Three misses per email stay under the per-email limit.
      const response = await verify(`guess${Math.floor(i / 3)}@example.com`, "ZZZZZZ", "198.51.100.7");
      expect(response.status).toBe(404);
    }
    const blocked = await verify("maria@example.com", "ABCDEF", "198.51.100.7");
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("set-cookie")).toBeNull();
    expect(tokens.get("maria@example.com--ABCDEF").used).toBe(false);
    // Another address is unaffected.
    expect((await verify("maria@example.com", "ABCDEF", "203.0.113.99")).status).toBe(200);
  });
});

describe("POST /api/login-verify", () => {
  it("returns no password-hash fields or token document to the browser", async () => {
    const response = await verify("maria@example.com", "ABCDEF");
    expect(response.status).toBe(200);
    const text = await response.text();
    for (const secret of ["secret-derived-key", "secret-salt", "derived_key", "pbkdf2", "iterations", "ABCDEF", "expires"])
      expect(text).not.toContain(secret);
    const body = JSON.parse(text);
    expect(body.success).toBe(true);
    // Shape consumed by apps/bitvocation confirm-login: resp.funnel || doc.funnel.
    expect(body.resp).toEqual({ funnel: "pow_lab_lite" });
    expect(body.doc).toMatchObject({ name: "maria", email: "Maria@Example.com", funnel: "pow_lab_lite" });
  });

  it("issues an HttpOnly SameSite=Lax session cookie and consumes the token", async () => {
    const response = await verify("maria@example.com", "ABCDEF");
    const cookie = response.headers.get("set-cookie")!;
    expect(cookie).toMatch(/^AuthSession=[^;]+; Version=1; Path=\/; HttpOnly/);
    expect(cookie).toContain("SameSite=Lax");
    expect(tokens.get("maria@example.com--ABCDEF").used).toBe(true);
  });

  it("accepts mixed-case email and lowercase code, and works only once", async () => {
    expect((await verify(" MARIA@example.com ", "abcdef")).status).toBe(200);
    const again = await verify("maria@example.com", "ABCDEF");
    expect(again.status).toBe(404);
    expect(again.headers.get("set-cookie")).toBeNull();
  });

  it("issues no session when the token was consumed concurrently", async () => {
    const doc = tokens.get("maria@example.com--ABCDEF");
    // Another request consumed it between our read and our write.
    const original = tokens.get.bind(tokens);
    let reads = 0;
    tokens.get = (id: string) => {
      const value = original(id);
      if (id === doc._id && reads++ === 0) tokens.set(id, { ...value, _rev: "2-t", used: true });
      return value;
    };
    try {
      const response = await verify("maria@example.com", "ABCDEF");
      expect(response.status).toBe(404);
      expect(response.headers.get("set-cookie")).toBeNull();
    } finally {
      tokens.get = original;
    }
  });

  it("rejects expired and unknown tokens", async () => {
    const doc = tokens.get("maria@example.com--ABCDEF");
    tokens.set(doc._id, { ...doc, expires: new Date(Date.now() - 1000).toISOString() });
    expect((await verify("maria@example.com", "ABCDEF")).status).toBe(404);
    expect((await verify("maria@example.com", "ZZZZZZ")).status).toBe(404);
  });
});
