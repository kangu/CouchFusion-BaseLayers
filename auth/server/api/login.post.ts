import { defineEventHandler, readBody, createError } from "h3";
import { getDocument, getView } from "#database/utils/couchdb";
import { createLoginToken } from "#auth/server/utils/login-token";
import {
  type ProofOfWorkSolution,
} from "#auth/server/utils/proof-of-work";
import { assertProofOfWork } from "#auth/server/utils/proof-of-work-runtime";
import { resolveCookieSecret } from "#auth/server/utils/session-cookie";
import {
  assertInvisibleFormShield,
  type InvisibleFormShieldPayload,
} from "#auth/server/utils/invisible-form-shield";

interface LoginRequestBody {
  email?: string;
  funnel?: string;
  affiliateCode?: string;
  proofOfWork?: ProofOfWorkSolution;
  invisibleShield?: InvisibleFormShieldPayload;
}

// Helper function so not to import anything external
function isValidEmail(email: unknown): email is string {
  // simple RFC 5322-ish check — good enough for most APIs
  return typeof email === "string" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
}

export default defineEventHandler(async (event) => {
  const body = await readBody<LoginRequestBody>(event);

  if (!body || !isValidEmail(body.email)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid input: "email" must be an email address',
    });
  }

  assertInvisibleFormShield(body.invisibleShield, { purpose: "login" });
  await resolveCookieSecret(); // refreshes the proof-of-work signing secret
  assertProofOfWork(body.proofOfWork, "login");

  const affiliateCode =
    typeof body.affiliateCode === "string" ? body.affiliateCode.trim() : "";

  const config = useRuntimeConfig();
  const dbLoginPrefix = config.dbLoginPrefix;

  // Validate required runtime config
  if (!config.dbLoginPrefix) {
    throw createError({
      statusCode: 500,
      statusMessage:
        "Server configuration error: dbLoginPrefix is required but not configured",
    });
  }

  const email = body.email.trim().toLowerCase();
  const existingAccount = await getView("_users", "auth", "has_account_case_insensitive", {
    key: email,
    limit: 1,
  });

  // Keep the response the same for existing and unknown addresses while only
  // issuing login tokens to accounts that already exist.
  if (!existingAccount?.rows?.length) {
    return { success: true, message: "If you have an account with us, you'll receive an email" };
  }

  let validatedAffiliateCode: string | undefined;

  if (affiliateCode) {
    const affiliateDocumentId = `org.couchdb.user:${dbLoginPrefix}${affiliateCode}`;

    try {
      const affiliateDocument = await getDocument<Record<string, unknown>>(
        "_users",
        affiliateDocumentId,
      );

      if (affiliateDocument && !affiliateDocument._deleted) {
        validatedAffiliateCode = affiliateCode;
      } else {
        console.warn(
          `Affiliate code rejected: ${affiliateCode} (user not found)`,
        );
      }
    } catch (error) {
      console.warn(
        `Failed to validate affiliate code "${affiliateCode}":`,
        error,
      );
    }
  }

  // One-time code (crypto-random, lifetime from runtimeConfig.authLoginTokenTtlMinutes),
  // stored in `${dbLoginPrefix}-logins` as `email--CODE`; `email` and `code` on the
  // document are what the watcher uses to build the email.
  await createLoginToken({
    email,
    funnel: body.funnel,
    fields: validatedAffiliateCode ? { affiliate_friend_code: validatedAffiliateCode } : undefined,
  });

  // send out the corresponding email
  // email is now sent through couchdb-monitor watching login tokens being created

  return { success: true, message: "If you have an account with us, you'll receive an email" };
});
