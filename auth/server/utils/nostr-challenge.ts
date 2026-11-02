import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { createError } from "h3";
import { resolveCookieSecret } from "#auth/server/utils/session-cookie";

interface NostrChallengePayload {
  challenge: string;
  npub: string;
  expiresAt: number;
}

const USED_NONCES = new Set<string>();
const CHALLENGE_SEPARATOR = ".";

const base64UrlEncode = (value: string): string =>
  Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

const base64UrlDecode = (value: string): string => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(`${normalized}${padding}`, "base64").toString("utf8");
};

/** Challenges are signed with CouchDB's own cookie secret (chttpd_auth/secret). */
const getChallengeSecret = async (): Promise<string> => {
  const secret = await resolveCookieSecret();

  if (!secret) {
    throw createError({
      statusCode: 500,
      statusMessage: "CouchDB cookie secret could not be read for Nostr challenge signing",
    });
  }

  return secret;
};

const signPayload = (payloadSegment: string, secret: string): string => {
  return createHmac("sha256", secret).update(payloadSegment).digest("hex");
};

export const issueNostrChallenge = async (
  npub: string,
  ttlSeconds = 300,
): Promise<{ challenge: string; token: string; expiresAt: string }> => {
  const nonce = randomBytes(18).toString("hex");
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
  const challenge = `nostr-login:${nonce}:${expiresAt}`;

  const payload: NostrChallengePayload = {
    challenge,
    npub,
    expiresAt,
  };

  const payloadSegment = base64UrlEncode(JSON.stringify(payload));
  const signatureSegment = signPayload(payloadSegment, await getChallengeSecret());

  return {
    challenge,
    token: `${payloadSegment}${CHALLENGE_SEPARATOR}${signatureSegment}`,
    expiresAt: new Date(expiresAt * 1000).toISOString(),
  };
};

export const verifyNostrChallenge = async (
  token: string,
  npub: string,
): Promise<NostrChallengePayload> => {
  const [payloadSegment, signatureSegment] = token.split(CHALLENGE_SEPARATOR);

  if (!payloadSegment || !signatureSegment) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid Nostr challenge token",
    });
  }

  const expectedSignature = signPayload(payloadSegment, await getChallengeSecret());
  const signatureBuffer = Buffer.from(signatureSegment, "hex");
  const expectedBuffer = Buffer.from(expectedSignature, "hex");

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    throw createError({
      statusCode: 401,
      statusMessage: "Nostr challenge token signature is invalid",
    });
  }

  let payload: NostrChallengePayload;

  try {
    payload = JSON.parse(base64UrlDecode(payloadSegment)) as NostrChallengePayload;
  } catch {
    throw createError({
      statusCode: 400,
      statusMessage: "Nostr challenge token payload is malformed",
    });
  }

  if (payload.npub !== npub) {
    throw createError({
      statusCode: 401,
      statusMessage: "Nostr challenge token does not match npub",
    });
  }

  if (!payload.challenge || !payload.expiresAt) {
    throw createError({
      statusCode: 400,
      statusMessage: "Nostr challenge token is incomplete",
    });
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (payload.expiresAt <= nowSeconds) {
    throw createError({
      statusCode: 401,
      statusMessage: "Nostr challenge expired",
    });
  }

  if (USED_NONCES.has(payload.challenge)) {
    throw createError({
      statusCode: 409,
      statusMessage: "Nostr challenge already used",
    });
  }

  return payload;
};

export const consumeNostrChallenge = (challenge: string): void => {
  USED_NONCES.add(challenge);
};
