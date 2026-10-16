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
  generateAuthSessionCookie: (name: string) =>
    `AuthSession=${Buffer.from(`${name}:stamp:sig`).toString("base64")}; Version=1; Path=/; HttpOnly`,
}));

let server: Server;
let url = "";
beforeAll(async () => {
  (globalThis as any).useRuntimeConfig = () => ({
    couchdbCookieSecret: "fixture-secret",
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
beforeEach(() => {
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

const verify = (email: string, token: string) =>
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, token }),
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
