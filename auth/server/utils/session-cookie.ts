import type { H3Event } from "h3";
import { setHeader } from "h3";
import { generateAuthSessionCookie, getSession } from "#database/utils/couchdb";
import {
  buildCouchEnvSection,
  readCouchConfigValue,
  resolveRuntimeAppSlug,
} from "#database/utils/couch-config";

/**
 * Long-lived login sessions for every app that extends the auth layer.
 *
 * CouchDB checks an `AuthSession` cookie against `stamp + [chttpd_auth] timeout` (600 s by
 * default) and would normally extend it on each request, but the app's server talks to
 * CouchDB itself, so that refresh never reaches the browser. Instead, every login issues
 * its own cookie stamped `maxAge` ahead (so CouchDB accepts it for that long without any
 * server-wide setting) with a matching `Max-Age`, so the browser keeps it across restarts.
 *
 * Length, first match wins:
 * 1. CouchDB `_config` `cf_env_<slug>` key `auth_session_max_age_seconds`
 * 2. `runtimeConfig.authSessionMaxAgeSeconds` (`NUXT_AUTH_SESSION_MAX_AGE_SECONDS`)
 * 3. one year
 *
 * Logout clears the browser cookie only. A stamped cookie cannot be revoked server-side
 * except by changing that user's password (new salt) or CouchDB's `chttpd_auth/secret`.
 */

export const DEFAULT_SESSION_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;
export const MIN_SESSION_MAX_AGE_SECONDS = 600;
export const SESSION_MAX_AGE_CONFIG_KEY = "auth_session_max_age_seconds";

const CACHE_MS = 5 * 60 * 1000;

type RuntimeConfigLike = Record<string, any> | null | undefined;

/** Parse a seconds value; `null` when missing or invalid. Values below 600 s are raised. */
export const parseSessionMaxAge = (value: unknown): number | null => {
  const n =
    typeof value === "number" ? value : Number.parseInt(String(value ?? "").trim(), 10);
  if (!Number.isFinite(n) || n <= 0) {
    return null;
  }
  return Math.max(MIN_SESSION_MAX_AGE_SECONDS, Math.floor(n));
};

let cachedMaxAge: { value: number; at: number } | null = null;
let cachedSecret: { value: string; at: number } | null = null;

/** Session length in seconds (see the precedence above). */
export const resolveSessionMaxAge = async (
  runtimeConfig: RuntimeConfigLike,
  readConfig: typeof readCouchConfigValue = readCouchConfigValue,
  now = Date.now(),
): Promise<number> => {
  if (cachedMaxAge && now - cachedMaxAge.at < CACHE_MS) {
    return cachedMaxAge.value;
  }
  const section = buildCouchEnvSection(resolveRuntimeAppSlug(runtimeConfig));
  const fromCouch = parseSessionMaxAge(
    await readConfig(section, SESSION_MAX_AGE_CONFIG_KEY).catch(() => null),
  );
  const value =
    fromCouch ??
    parseSessionMaxAge(runtimeConfig?.authSessionMaxAgeSeconds) ??
    DEFAULT_SESSION_MAX_AGE_SECONDS;
  cachedMaxAge = { value, at: now };
  return value;
};

/**
 * CouchDB's cookie secret, read from the server's own `chttpd_auth/secret` (legacy
 * `couch_httpd_auth/secret`) with the admin credentials the app already has. It is the only
 * secret CouchDB accepts `AuthSession` cookies for, so apps configure nothing. The value is
 * cached for five minutes; a failed read is not cached and falls back to the last good value.
 * The same secret signs Nostr login challenges and proof-of-work challenges.
 */
export const resolveCookieSecret = async (
  readConfig: typeof readCouchConfigValue = readCouchConfigValue,
  now = Date.now(),
): Promise<string | null> => {
  if (cachedSecret && now - cachedSecret.at < CACHE_MS) {
    return cachedSecret.value;
  }
  const value =
    (await readConfig("chttpd_auth", "secret").catch(() => null)) ||
    (await readConfig("couch_httpd_auth", "secret").catch(() => null)) ||
    null;
  if (value) {
    cachedSecret = { value, at: now };
    return value;
  }
  return cachedSecret?.value ?? null;
};

/**
 * The last cookie secret read from CouchDB, for callers that cannot await (the auth init
 * plugin reads it at server start; `resolveCookieSecret` refreshes it). `null` until read.
 */
export const getCachedCookieSecret = (): string | null => cachedSecret?.value ?? null;

/**
 * Salt from a CouchDB `[admins]` password hash: `-pbkdf2:<prf>-<key>,<salt>,<iterations>`,
 * `-pbkdf2-<key>,<salt>,<iterations>` or `-hashed-<hash>,<salt>`. `null` for anything else
 * (e.g. a plain-text admin password CouchDB has not hashed yet).
 */
export const parseAdminHashSalt = (hash: unknown): string | null => {
  if (typeof hash !== "string" || !/^-(pbkdf2|hashed)[-:]/.test(hash)) {
    return null;
  }
  const salt = hash.split(",")[1];
  return salt ? salt : null;
};

/**
 * The salt CouchDB checks a session cookie with. CouchDB looks up server admins
 * (`[admins]` in its config) before `_users`, so for a name that is also a server admin
 * the salt comes from the admin password hash, not from the `_users` document.
 */
export const resolveCookieSalt = async (
  name: string,
  userDocSalt: unknown,
  readConfig: typeof readCouchConfigValue = readCouchConfigValue,
): Promise<string | null> => {
  const adminSalt = parseAdminHashSalt(
    await readConfig("admins", name).catch(() => null),
  );
  if (adminSalt) {
    return adminSalt;
  }
  return typeof userDocSalt === "string" && userDocSalt ? userDocSalt : null;
};

/** Test hook: forget cached config values. */
export const resetSessionCookieCache = () => {
  cachedMaxAge = null;
  cachedSecret = null;
};

/** The `Set-Cookie` value for a long-lived session of `user`. */
export const buildSessionCookie = (
  user: { name: string; salt: string },
  secret: string,
  maxAgeSeconds: number,
): string =>
  `${generateAuthSessionCookie(user.name, secret, user.salt, maxAgeSeconds, {
    maxAgeSeconds,
  })}; SameSite=Lax`;

/**
 * Set a long-lived session cookie on the response. `user` is the `_users` document (or
 * just `{ name }` for a server admin without one). Returns false (and sets nothing) when
 * no salt or no cookie secret is available.
 */
export const issueSessionCookie = async (
  event: H3Event,
  user: { name?: unknown; salt?: unknown } | null | undefined,
  runtimeConfig: RuntimeConfigLike = useRuntimeConfig(),
): Promise<boolean> => {
  if (!user || typeof user.name !== "string" || !user.name || user.name.includes(":")) {
    return false;
  }
  const [secret, salt] = await Promise.all([
    resolveCookieSecret(),
    resolveCookieSalt(user.name, user.salt),
  ]);
  if (!secret || !salt) {
    return false;
  }
  const maxAge = await resolveSessionMaxAge(runtimeConfig);
  const cookie = buildSessionCookie({ name: user.name, salt }, secret, maxAge);
  // Never hand out a cookie CouchDB would reject (wrong secret or salt): check it first.
  if (!(await couchAccepts(cookie, user.name))) {
    console.warn(`[auth] CouchDB rejected the issued session cookie for ${user.name}`);
    return false;
  }
  setHeader(event, "Set-Cookie", cookie);
  return true;
};

/** Ask CouchDB whether a `Set-Cookie` value authenticates as `name`. */
export const couchAccepts = async (
  setCookie: string,
  name: string,
  session: typeof getSession = getSession,
): Promise<boolean> => {
  const value = setCookie.split(";")[0];
  const response = await session({ authSessionCookie: value }).catch(() => null);
  return response?.userCtx?.name === name;
};
