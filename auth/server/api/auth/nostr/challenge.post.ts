import { createError, defineEventHandler, readBody } from "h3";
import { issueNostrChallenge } from "#auth/server/utils/nostr-challenge";
import { normalizeNostrIdentity } from "#auth/server/utils/nostr-auth";

interface NostrChallengePayload {
  npub?: unknown;
  pubkey?: unknown;
}

export default defineEventHandler(async (event) => {
  const payload = await readBody<NostrChallengePayload>(event);
  const identityInput =
    typeof payload?.npub === "string" && payload.npub.trim().length > 0
      ? payload.npub
      : payload?.pubkey;

  const identity = normalizeNostrIdentity(identityInput);

  const runtimeConfig = useRuntimeConfig();
  const ttlSeconds = Number.parseInt(
    String(runtimeConfig.nostrChallengeTtlSeconds ?? "300"),
    10,
  );

  if (!Number.isFinite(ttlSeconds) || ttlSeconds < 60 || ttlSeconds > 900) {
    throw createError({
      statusCode: 500,
      statusMessage: "nostrChallengeTtlSeconds must be between 60 and 900",
    });
  }

  const challenge = issueNostrChallenge(identity.npub, ttlSeconds);

  return {
    success: true,
    npub: identity.npub,
    challenge: challenge.challenge,
    challengeToken: challenge.token,
    expiresAt: challenge.expiresAt,
  };
});
