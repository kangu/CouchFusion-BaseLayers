import { randomInt } from "node:crypto";
import { putDocument } from "#database/utils/couchdb";

interface CreateLoginTokenOptions {
  email: string;
  funnel?: string;
  /** Extra fields stored on the token document (e.g. `affiliate_friend_code`). */
  fields?: Record<string, unknown>;
}

interface CreatedLoginToken {
  email: string;
  code: string;
  expires: string;
}

export const LOGIN_CODE_LENGTH = 6;
const DEFAULT_TTL_MINUTES = 60;
const MAX_TTL_MINUTES = 24 * 60;

/**
 * Six uppercase letters (A–Z), drawn with `crypto.randomInt` so every letter is
 * equally likely and the sequence can't be predicted. Same format as before, so the
 * token document `_id` (`email--CODE`) and the email templates are unchanged.
 */
export const createLoginCode = (): string =>
  Array.from({ length: LOGIN_CODE_LENGTH }, () => String.fromCharCode(65 + randomInt(26))).join("");

/**
 * How long a login code stays valid: `runtimeConfig.authLoginTokenTtlMinutes`
 * (`NUXT_AUTH_LOGIN_TOKEN_TTL_MINUTES`), 1–1440, default 60. Codes reach people by email,
 * and some flows (order emails) are opened later, so the default stays generous;
 * admin-only apps can lower it.
 */
export const loginTokenTtlMs = (config: { authLoginTokenTtlMinutes?: unknown } = useRuntimeConfig()): number => {
  const minutes = Number(config?.authLoginTokenTtlMinutes);
  const valid = Number.isFinite(minutes) && minutes >= 1 && minutes <= MAX_TTL_MINUTES;
  return (valid ? Math.round(minutes) : DEFAULT_TTL_MINUTES) * 60 * 1000;
};

/**
 * Persists a one-time token that the login verification endpoint consumes.
 * Used by `POST /api/login` and by other layers that email a login code.
 */
export const createLoginToken = async ({
  email,
  funnel,
  fields,
}: CreateLoginTokenOptions): Promise<CreatedLoginToken> => {
  const normalizedEmail = email.trim().toLowerCase();
  const config = useRuntimeConfig();
  const dbLoginPrefix = config.dbLoginPrefix;

  if (!normalizedEmail || !dbLoginPrefix) {
    throw new Error("Email and dbLoginPrefix are required to create a login token.");
  }

  const timestamp = new Date();
  const expires = new Date(timestamp.getTime() + loginTokenTtlMs(config)).toISOString();
  const code = createLoginCode();

  const result = await putDocument(`${dbLoginPrefix}-logins`, {
    ...fields,
    _id: `${normalizedEmail}--${code}`,
    email: normalizedEmail,
    code,
    funnel,
    timestamp: timestamp.toISOString(),
    expires,
    used: false,
  });

  if (!result.ok) {
    throw new Error("Failed to persist login token.");
  }

  return { email: normalizedEmail, code, expires };
};
