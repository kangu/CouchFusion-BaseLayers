// The `auth` route middleware: signed-out visitors on admin areas get a 404, everything else
// protected still redirects to the login page. Nuxt's auto-imported helpers are stubbed.
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { isAuthHiddenPath, parseAuthHiddenPaths } from "../utils/hidden-paths";

let user: unknown = null;
vi.mock("../stores/auth", () => ({ useAuthStore: () => ({ fetchUser: async () => user }) }));

const cookie = { value: undefined as string | undefined };
const navigateTo = vi.fn((path: string) => ({ redirectedTo: path }));
let publicConfig: Record<string, unknown> = {};
let middleware: (to: { path: string; fullPath: string }, from: unknown) => Promise<unknown>;

beforeAll(async () => {
  Object.assign(globalThis, {
    defineNuxtRouteMiddleware: (fn: unknown) => fn,
    useRuntimeConfig: () => ({ public: publicConfig }),
    useCookie: () => cookie,
    navigateTo,
    createError: (input: { statusCode: number; statusMessage: string }) =>
      Object.assign(new Error(input.statusMessage), input),
  });
  middleware = (await import("./auth")).default as typeof middleware;
});

beforeEach(() => {
  user = null;
  cookie.value = undefined;
  navigateTo.mockClear();
  publicConfig = { authLoginPath: "/login", authHiddenPaths: "/admin,/builder,/k" };
});

const visit = (path: string) => middleware({ path, fullPath: path }, null);

describe("auth middleware", () => {
  it.each(["/admin", "/admin/", "/admin/signups", "/admin/analytics/events", "/builder", "/builder/despre", "/k", "/k/test/head", "/ADMIN", "//admin", "/%61dmin"])(
    "signed out on %s: 404, no redirect, no redirectTo cookie",
    async (path) => {
      await expect(visit(path)).rejects.toMatchObject({ statusCode: 404, statusMessage: "Page not found" });
      expect(navigateTo).not.toHaveBeenCalled();
      expect(cookie.value).toBeUndefined();
    },
  );

  it.each(["/members", "/account/orders", "/administrator", "/kids", "/builders-guild"])(
    "signed out on other protected pages (%s): redirect to the login page, as before",
    async (path) => {
      expect(await visit(path)).toEqual({ redirectedTo: "/login" });
      expect(cookie.value).toBe(path);
    },
  );

  it("signed in: no 404 and no redirect", async () => {
    user = { name: "editor", roles: ["admin"] };
    expect(await visit("/admin/signups")).toBeUndefined();
    expect(await visit("/k")).toBeUndefined();
    expect(navigateTo).not.toHaveBeenCalled();
  });

  it("the login page itself is never hidden", async () => {
    publicConfig = { authLoginPath: "/admin/login", authHiddenPaths: "/admin" };
    expect(await visit("/admin/login")).toBeUndefined();
  });

  it("follows the app's setting: other prefixes, or '' for the old redirect everywhere", async () => {
    publicConfig = { authLoginPath: "/login", authHiddenPaths: "/backoffice" };
    await expect(visit("/backoffice/x")).rejects.toMatchObject({ statusCode: 404 });
    expect(await visit("/admin")).toEqual({ redirectedTo: "/login" });

    publicConfig = { authLoginPath: "/login", authHiddenPaths: "" };
    expect(await visit("/admin")).toEqual({ redirectedTo: "/login" });
  });

  it("uses the default prefixes when the app doesn't set any", async () => {
    publicConfig = { authLoginPath: "/login" };
    await expect(visit("/builder")).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("hidden path helpers", () => {
  it("parse a comma-separated list (or an array), ignoring blanks, case, trailing slashes and '/'", () => {
    expect(parseAuthHiddenPaths(" /Admin/ , ,/k,/ ,builder")).toEqual(["/admin", "/k"]);
    expect(parseAuthHiddenPaths(["/x/", "/Y"])).toEqual(["/x", "/y"]);
    expect(parseAuthHiddenPaths(undefined)).toEqual([]);
  });

  it("match whole segments only", () => {
    const prefixes = ["/admin", "/k"];
    expect(isAuthHiddenPath("/admin-not-here", prefixes)).toBe(false);
    expect(isAuthHiddenPath("/kangaroo/k", prefixes)).toBe(false);
    expect(isAuthHiddenPath("/k/", prefixes)).toBe(true);
    expect(isAuthHiddenPath("/%E0%A4%A", prefixes)).toBe(false);
  });
});
