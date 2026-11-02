import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const putDocument = vi.fn(async (_db: string, doc: { _id: string }) => ({ ok: true, id: doc._id, rev: "1-x" }));
vi.mock("#database/utils/couchdb", () => ({ putDocument: (db: string, doc: any) => putDocument(db, doc) }));

import { createLoginCode, createLoginToken, LOGIN_CODE_LENGTH, loginTokenTtlMs } from "./login-token";

describe("login codes", () => {
  it("are six uppercase letters", () => {
    for (let i = 0; i < 200; i++) expect(createLoginCode()).toMatch(/^[A-Z]{6}$/);
    expect(LOGIN_CODE_LENGTH).toBe(6);
  });

  it("use every letter (crypto.randomInt, no modulo bias toward A–V)", () => {
    const counts = new Map<string, number>();
    for (let i = 0; i < 4000; i++) for (const ch of createLoginCode()) counts.set(ch, (counts.get(ch) ?? 0) + 1);
    expect(counts.size).toBe(26);
    // 24 000 letters: ~923 each. W–Z were 10 % rarer with `byte % 26`; allow ±20 %.
    for (const n of counts.values()) {
      expect(n).toBeGreaterThan(738);
      expect(n).toBeLessThan(1108);
    }
  });

  it("are no longer made with Math.random in POST /api/login", () => {
    const route = readFileSync(resolve(__dirname, "../api/login.post.ts"), "utf8");
    expect(route).not.toContain("Math.random");
    expect(route).toContain("createLoginToken(");
  });
});

describe("login code lifetime", () => {
  it("defaults to 60 minutes and follows authLoginTokenTtlMinutes (1–1440)", () => {
    expect(loginTokenTtlMs({})).toBe(60 * 60_000);
    expect(loginTokenTtlMs({ authLoginTokenTtlMinutes: 15 })).toBe(15 * 60_000);
    expect(loginTokenTtlMs({ authLoginTokenTtlMinutes: "10" })).toBe(10 * 60_000);
    for (const bad of [0, -5, 5000, "soon", null]) {
      expect(loginTokenTtlMs({ authLoginTokenTtlMinutes: bad })).toBe(60 * 60_000);
    }
  });
});

describe("createLoginToken", () => {
  beforeEach(() => {
    putDocument.mockClear();
    (globalThis as any).useRuntimeConfig = () => ({ dbLoginPrefix: "bv", authLoginTokenTtlMinutes: 15 });
  });
  afterEach(() => {
    delete (globalThis as any).useRuntimeConfig;
  });

  it("stores email--CODE with the configured lifetime and extra fields", async () => {
    const before = Date.now();
    const token = await createLoginToken({
      email: " Maria@Example.com ",
      funnel: "lab",
      fields: { affiliate_friend_code: "friend1" },
    });
    const [db, doc] = putDocument.mock.calls[0];
    expect(db).toBe("bv-logins");
    expect(doc).toMatchObject({
      _id: `maria@example.com--${token.code}`,
      email: "maria@example.com",
      code: token.code,
      funnel: "lab",
      used: false,
      affiliate_friend_code: "friend1",
    });
    const ttl = Date.parse(doc.expires) - before;
    expect(ttl).toBeGreaterThan(15 * 60_000 - 2000);
    expect(ttl).toBeLessThanOrEqual(15 * 60_000 + 2000);
  });

  it("extra fields cannot override the token's own fields", async () => {
    await createLoginToken({ email: "a@b.ro", fields: { used: true, _id: "x", code: "AAAAAA" } });
    const [, doc] = putDocument.mock.calls[0];
    expect(doc.used).toBe(false);
    expect(doc._id).toBe(`a@b.ro--${doc.code}`);
    expect(doc.code).not.toBe("x");
  });
});
