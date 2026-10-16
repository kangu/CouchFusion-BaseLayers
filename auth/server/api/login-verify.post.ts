// Checks to see if the provided login token is valid

import { defineEventHandler, readBody, createError, setHeader } from "h3";
import {
  getDocument,
  putDocument,
  getView,
  generateAuthSessionCookie,
} from "#database/utils/couchdb";
import { sanitizeUserDoc } from "../utils/sanitizeUserDoc";

// Issued cookies are stamped this far ahead, extending CouchDB's own timeout (~69 days).
const SESSION_STAMP_OFFSET_SECONDS = 6000000;

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

  // Validate cookie secret is available
  if (!runtimeConfig.couchdbCookieSecret) {
    throw createError({
      statusCode: 500,
      statusMessage: "CouchDB cookie secret not configured",
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

    const newCookie = generateAuthSessionCookie(
      userDoc.name,
      runtimeConfig.couchdbCookieSecret,
      userDoc.salt,
      SESSION_STAMP_OFFSET_SECONDS,
    );
    setHeader(event, "Set-Cookie", `${newCookie}; SameSite=Lax`);

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
