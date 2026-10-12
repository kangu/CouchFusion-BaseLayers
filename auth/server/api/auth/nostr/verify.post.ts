import { createError, defineEventHandler, readBody, setHeader } from "h3";
import {
  generateAuthSessionCookie,
  getView,
} from "#database/utils/couchdb";
import { verifyEvent, type Event } from "nostr-tools";
import { consumeNostrChallenge, verifyNostrChallenge } from "#auth/server/utils/nostr-challenge";
import {
  normalizeNostrIdentity,
  sanitizeAuthUser,
} from "#auth/server/utils/nostr-auth";

interface NostrVerifyPayload {
  npub?: unknown;
  pubkey?: unknown;
  challengeToken?: unknown;
  event?: unknown;
}

interface NostrLinkedUserDocument {
  _id: string;
  _rev?: string;
  type: "user";
  name: string;
  roles?: string[];
  nostr?: {
    npub: string;
    pubkey: string;
    linked_at: string;
  };
  [key: string]: any;
}

const validateSignedEvent = (eventCandidate: unknown, challenge: string, pubkey: string) => {
  if (!eventCandidate || typeof eventCandidate !== "object") {
    throw createError({
      statusCode: 400,
      statusMessage: "Signed event is required",
    });
  }

  const event = eventCandidate as Event;

  if (!verifyEvent(event)) {
    throw createError({
      statusCode: 401,
      statusMessage: "Invalid Nostr signature",
    });
  }

  if (event.pubkey !== pubkey) {
    throw createError({
      statusCode: 401,
      statusMessage: "Signed event pubkey does not match the provided identity",
    });
  }

  if (event.content !== challenge) {
    throw createError({
      statusCode: 401,
      statusMessage: "Signed event content does not match the issued challenge",
    });
  }

  return event;
};

const resolveLinkedUser = async (
  npub: string,
): Promise<NostrLinkedUserDocument | null> => {
  const result = await getView("_users", "auth", "by_nostr_npub", {
    key: npub,
    include_docs: true,
    limit: 1,
  });

  const row = result?.rows?.[0];
  const doc = row?.doc as NostrLinkedUserDocument | undefined;

  if (!doc || doc.type !== "user") {
    return null;
  }

  return doc;
};

export default defineEventHandler(async (event) => {
  const payload = await readBody<NostrVerifyPayload>(event);

  const identityInput =
    typeof payload?.npub === "string" && payload.npub.trim().length > 0
      ? payload.npub
      : payload?.pubkey;
  const identity = normalizeNostrIdentity(identityInput);

  if (typeof payload?.challengeToken !== "string" || !payload.challengeToken.trim().length) {
    throw createError({
      statusCode: 400,
      statusMessage: "challengeToken is required",
    });
  }

  const challengePayload = verifyNostrChallenge(
    payload.challengeToken,
    identity.npub,
  );

  validateSignedEvent(payload.event, challengePayload.challenge, identity.pubkey);

  const userDoc = await resolveLinkedUser(identity.npub);

  if (!userDoc) {
    throw createError({
      statusCode: 404,
      statusMessage: "No account is linked to this Nostr identity.",
    });
  }

  if (!userDoc?.salt || !userDoc?.name) {
    throw createError({
      statusCode: 500,
      statusMessage: "CouchDB user record is missing required session fields",
    });
  }

  const runtimeConfig = useRuntimeConfig();
  if (!runtimeConfig.couchdbCookieSecret) {
    throw createError({
      statusCode: 500,
      statusMessage: "CouchDB cookie secret not configured",
    });
  }

  const newCookie = generateAuthSessionCookie(
    userDoc.name,
    runtimeConfig.couchdbCookieSecret,
    userDoc.salt,
    6_000_000,
  );

  setHeader(event, "Set-Cookie", newCookie);
  consumeNostrChallenge(challengePayload.challenge);
  return {
    success: true,
    npub: identity.npub,
    user: sanitizeAuthUser(userDoc),
  };
});
