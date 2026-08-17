import { randomBytes } from "node:crypto";
import { putDocument } from "#database/utils/couchdb";

interface CreateLoginTokenOptions {
  email: string;
  funnel?: string;
}

interface CreatedLoginToken {
  email: string;
  code: string;
  expires: string;
}

const LOGIN_TOKEN_TTL_MS = 60 * 60 * 1000;

/**
 * Generates a six-letter uppercase code suitable for the existing login-token
 * document and email-template contract.
 */
const createLoginCode = (): string => [...randomBytes(6)]
  .map((value) => String.fromCharCode(65 + (value % 26)))
  .join("");

/**
 * Persists a one-time token that can be consumed by the existing login
 * verification endpoint without relying on the retired CouchDB monitor.
 */
export const createLoginToken = async ({
  email,
  funnel,
}: CreateLoginTokenOptions): Promise<CreatedLoginToken> => {
  const normalizedEmail = email.trim().toLowerCase();
  const dbLoginPrefix = useRuntimeConfig().dbLoginPrefix;

  if (!normalizedEmail || !dbLoginPrefix) {
    throw new Error("Email and dbLoginPrefix are required to create a login token.");
  }

  const timestamp = new Date();
  const expires = new Date(timestamp.getTime() + LOGIN_TOKEN_TTL_MS).toISOString();
  const code = createLoginCode();

  const result = await putDocument(`${dbLoginPrefix}-logins`, {
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
