// Checks to see if the provided login token is valid

import { defineEventHandler, readBody, createError } from "h3";
import {
  getAllDocs,
  getDocument,
  putDocument,
  getView,
} from "#database/utils/couchdb";
import { sanitizeUserDoc } from "../utils/sanitizeUserDoc";
import { issueSessionCookie, resolveCookieSecret } from "../utils/session-cookie";
import {
  clientAddress,
  codeFailuresByAddress,
  codeFailuresByEmail,
  LOGIN_LIMITS,
} from "../utils/login-limits";

/** Marks every pending code of `email` as used, so a new code has to be requested. */
async function cancelPendingCodes(db: string, email: string) {
  const result = await getAllDocs(db, {
    startkey: `${email}--`,
    endkey: `${email}--￰`,
    include_docs: true,
  });
  const pending = (result?.rows ?? [])
    .map((row) => row.doc)
    .filter((doc): doc is NonNullable<typeof doc> => !!doc && !doc.used);
  const cancelledAt = new Date().toISOString();
  await Promise.all(
    pending.map((doc) =>
      putDocument(db, { ...doc, used: true, cancelled: "too-many-wrong-codes", cancelledAt }).catch(() => null),
    ),
  );
}

/**
 * Counts a wrong (or expired) code. On the email's 5th within the window its pending
 * codes are cancelled and the caller gets 429; the count restarts, so a new code works.
 * The response is the same whether or not the email has an account.
 */
async function recordWrongCode(db: string, email: string, address: string) {
  codeFailuresByAddress.fail(address);
  if (codeFailuresByEmail.fail(email) < LOGIN_LIMITS.codeFailuresPerEmail) return;
  codeFailuresByEmail.reset(email);
  await cancelPendingCodes(db, email).catch((error) => {
    console.warn("[auth] could not cancel pending login codes", error);
  });
  throw createError({
    statusCode: 429,
    statusMessage: "Too many wrong codes. Request a new code.",
  });
}


// Helper function so not to import anything external
function isValidEmail(email) {
  // simple RFC 5322-ish check — good enough for most APIs
  return typeof email === "string" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
}

// Checks expiration date and if it's not used
function isNotExpired(tokenDoc) {
  if (!tokenDoc || !tokenDoc.expires || tokenDoc.used) {
    return false;
  }
  const currentTime = new Date();
  const expirationTime = new Date(tokenDoc.expires);
  return currentTime < expirationTime;
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const runtimeConfig = useRuntimeConfig();

  // CouchDB's cookie secret must be readable before the token is consumed
  if (!(await resolveCookieSecret())) {
    throw createError({
      statusCode: 500,
      statusMessage: "CouchDB cookie secret could not be read",
    });
  }

  //
  // Validation
  //
  if (!body || typeof body.email !== "string" || !isValidEmail(body.email.trim())) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid input: "email" must be an email address',
    });
  }
  if (!body || typeof body.token !== "string") {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid input: "token" must be a string',
    });
  }

  // Token documents are created with a normalized email and an uppercase code.
  const email = body.email.trim().toLowerCase();
  const token = body.token.trim().toUpperCase();

  const address = clientAddress(event);
  if (codeFailuresByAddress.blocked(address)) {
    throw createError({
      statusCode: 429,
      statusMessage: "Too many attempts. Try again later.",
    });
  }

  // get couch
  const dbLoginPrefix = runtimeConfig.dbLoginPrefix;
  const DB = `${dbLoginPrefix}-logins`;

  try {
    // Get the login token document using authenticated CouchDB request
    const tokenDocId = `${email}--${token}`;
    const resp = await getDocument(DB, tokenDocId);

    // if resp is null, document doesn't exist (invalid token)
    // if it exists, check expiration and usage
    if (!resp || !isNotExpired(resp)) {
      await recordWrongCode(DB, email, address);
      throw createError({
        statusCode: 404,
        statusMessage: "Invalid login",
      });
    }

    const existingDocs = await getView(
      "_users",
      "auth",
      "has_account_case_insensitive",
      {
        key: email,
      },
    );
    const userDoc = existingDocs?.rows?.[0]?.value;
    if (!userDoc) {
      throw createError({ statusCode: 404, statusMessage: "Invalid login" });
    }

    // Consume the token before issuing a session. putDocument sends the fetched
    // _rev, so a concurrent second use fails with a conflict and is rejected below.
    await putDocument(DB, { ...resp, used: true });
    codeFailuresByEmail.reset(email);

    // Long-lived session (one year by default, see server/utils/session-cookie.ts).
    if (!(await issueSessionCookie(event, userDoc, runtimeConfig))) {
      throw createError({
        statusCode: 500,
        statusMessage: "CouchDB cookie secret not configured",
      });
    }

    // Only non-secret data goes back to the browser: never password-hash fields
    // or the token document. `resp.funnel` and `doc` keep the existing response shape.
    return {
      success: true,
      resp: { funnel: resp.funnel },
      doc: sanitizeUserDoc(userDoc),
    };
  } catch (e) {
    // Re-throw if it's already a createError
    if (e.statusCode) {
      throw e;
    }
    // Otherwise (including a token-consumption conflict), treat as invalid login
    throw createError({
      statusCode: 404,
      statusMessage: "Invalid login",
    });
  }
});
