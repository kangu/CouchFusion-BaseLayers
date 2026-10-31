import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_SESSION_MAX_AGE_SECONDS,
  buildSessionCookie,
  parseSessionMaxAge,
  resetSessionCookieCache,
  resolveCookieSecret,
  resolveSessionMaxAge,
} from "./session-cookie";

beforeEach(() => resetSessionCookieCache());

describe("parseSessionMaxAge", () => {
  it("accepts positive seconds and raises tiny values to 600", () => {
    expect(parseSessionMaxAge("86400")).toBe(86400);
    expect(parseSessionMaxAge(31536000)).toBe(31536000);
    expect(parseSessionMaxAge("60")).toBe(600);
    expect(parseSessionMaxAge("")).toBeNull();
    expect(parseSessionMaxAge("abc")).toBeNull();
    expect(parseSessionMaxAge(0)).toBeNull();
    expect(parseSessionMaxAge(undefined)).toBeNull();
  });
});

describe("resolveSessionMaxAge", () => {
  const runtime = { public: { appSlug: "radustanciu" }, authSessionMaxAgeSeconds: 7200 };

  it("prefers the app's cf_env value", async () => {
    const read = vi.fn(async () => "86400");
    expect(await resolveSessionMaxAge(runtime, read)).toBe(86400);
    expect(read).toHaveBeenCalledWith("cf_env_radustanciu", "auth_session_max_age_seconds");
  });

  it("falls back to runtime config, then one year", async () => {
    expect(await resolveSessionMaxAge(runtime, async () => null)).toBe(7200);
    resetSessionCookieCache();
    expect(await resolveSessionMaxAge({ public: { appSlug: "x" } }, async () => null)).toBe(
      DEFAULT_SESSION_MAX_AGE_SECONDS,
    );
  });

  it("caches for a few minutes", async () => {
    const read = vi.fn(async () => "86400");
    await resolveSessionMaxAge(runtime, read, 0);
    await resolveSessionMaxAge(runtime, read, 60_000);
    expect(read).toHaveBeenCalledTimes(1);
    await resolveSessionMaxAge(runtime, read, 10 * 60_000);
    expect(read).toHaveBeenCalledTimes(2);
  });
});

describe("resolveCookieSecret", () => {
  it("uses the configured secret without asking CouchDB", async () => {
    const read = vi.fn();
    expect(await resolveCookieSecret({ couchdbCookieSecret: " s3 " }, read)).toBe("s3");
    expect(read).not.toHaveBeenCalled();
  });

  it("falls back to CouchDB's chttpd_auth secret, then couch_httpd_auth", async () => {
    const read = vi.fn(async (section: string) => (section === "couch_httpd_auth" ? "old" : null));
    expect(await resolveCookieSecret({}, read)).toBe("old");
    expect(read).toHaveBeenNthCalledWith(1, "chttpd_auth", "secret");
    resetSessionCookieCache();
    expect(await resolveCookieSecret({}, async () => null)).toBeNull();
  });
});

describe("buildSessionCookie", () => {
  it("is stamped max-age ahead, persistent, and signed the way CouchDB checks it", () => {
    const now = 1_900_000_000;
    vi.useFakeTimers();
    vi.setSystemTime(now * 1000);
    const cookie = buildSessionCookie({ name: "radu", salt: "salt1" }, "secret1", 31536000);
    vi.useRealTimers();

    expect(cookie).toMatch(/; Path=\/; Max-Age=31536000; HttpOnly/);
    expect(cookie.endsWith("; SameSite=Lax")).toBe(true);

    const value = cookie.split(";")[0].slice("AuthSession=".length);
    const raw = Buffer.from(value, "base64url");
    const [user, hex] = raw.toString("latin1").split(":");
    expect(user).toBe("radu");
    // CouchDB accepts the cookie while stamp + its timeout (600 s) is in the future.
    expect(parseInt(hex, 16)).toBe(now + 31536000);
    const mac = createHmac("sha1", "secret1salt1").update(`radu:${hex}`).digest();
    expect(raw.subarray(raw.length - mac.length).equals(mac)).toBe(true);
  });
});

describe("cookie salt (server admins first, like CouchDB)", () => {
  it("parses admin hash salts", async () => {
    const { parseAdminHashSalt } = await import("./session-cookie");
    expect(parseAdminHashSalt("-pbkdf2:sha256-abc123,salt9,600000")).toBe("salt9");
    expect(parseAdminHashSalt("-pbkdf2-abc123,salt8,10")).toBe("salt8");
    expect(parseAdminHashSalt("-hashed-abc,salt7")).toBe("salt7");
    expect(parseAdminHashSalt("plaintext")).toBeNull();
    expect(parseAdminHashSalt(null)).toBeNull();
  });

  it("prefers the admin salt over the _users salt", async () => {
    const { resolveCookieSalt } = await import("./session-cookie");
    const admins = async (section: string, key: string) =>
      section === "admins" && key === "radu" ? "-pbkdf2:sha256-k,adminsalt,600000" : null;
    expect(await resolveCookieSalt("radu", "docsalt", admins)).toBe("adminsalt");
    expect(await resolveCookieSalt("maria", "docsalt", admins)).toBe("docsalt");
    expect(await resolveCookieSalt("nobody", undefined, admins)).toBeNull();
  });
});

describe("couchAccepts", () => {
  it("passes only the cookie value and checks the user name", async () => {
    const { couchAccepts } = await import("./session-cookie");
    const session = vi.fn(async () => ({ ok: true, userCtx: { name: "radu", roles: [] } }) as any);
    expect(await couchAccepts("AuthSession=abc; Path=/; Max-Age=1", "radu", session)).toBe(true);
    expect(session).toHaveBeenCalledWith({ authSessionCookie: "AuthSession=abc" });
    expect(await couchAccepts("AuthSession=abc", "maria", session)).toBe(false);
    expect(await couchAccepts("AuthSession=abc", "radu", async () => null)).toBe(false);
  });
});
