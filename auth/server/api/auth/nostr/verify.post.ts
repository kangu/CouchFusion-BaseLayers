import { createError, defineEventHandler, readBody, setHeader } from "h3";
import {
  createUser,
  generateAuthSessionCookie,
  getDocument,
  getView,
  putDocument,
} from "#database/utils/couchdb";
import { verifyEvent, type Event } from "nostr-tools";
import { consumeNostrChallenge, verifyNostrChallenge } from "#auth/server/utils/nostr-challenge";
import {
  normalizeNostrIdentity,
  sanitizeAuthUser,
} from "#auth/server/utils/nostr-auth";
import { fetchNostrProfileSeed } from "#auth/server/utils/nostr-profile";

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
  conference_prefs?: {
    favorites?: string[];
    watched?: string[];
  };
  nostr?: {
    npub: string;
    pubkey: string;
    linked_at: string;
  };
  [key: string]: any;
}

const randomPassword = (): string => {
  return `${crypto.randomUUID()}-${Date.now().toString(16)}`;
};

const normalizeConferencePrefs = (
  value: NostrLinkedUserDocument["conference_prefs"],
): { favorites: string[]; watched: string[] } => {
  const favorites = Array.isArray(value?.favorites)
    ? value.favorites.filter((entry) => typeof entry === "string" && entry.length > 0)
    : [];
  const watched = Array.isArray(value?.watched)
    ? value.watched.filter((entry) => typeof entry === "string" && entry.length > 0)
    : [];

  return {
    favorites: Array.from(new Set(favorites)),
    watched: Array.from(new Set(watched)),
  };
};

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

  let userDoc = await resolveLinkedUser(identity.npub);

  if (!userDoc) {
    const runtimeConfig = useRuntimeConfig();
    const dbLoginPrefix = runtimeConfig.dbLoginPrefix;

    if (typeof dbLoginPrefix !== "string" || !dbLoginPrefix.length) {
      throw createError({
        statusCode: 500,
        statusMessage: "dbLoginPrefix runtime config is missing",
      });
    }

    const username = `${dbLoginPrefix}${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;
    const nowIso = new Date().toISOString();
    const profileSeed = await fetchNostrProfileSeed(identity.pubkey);

    await createUser(username, randomPassword(), {
      email: profileSeed?.email || null,
      allow_affiliate: false,
      created_date: nowIso,
      conference_prefs: {
        favorites: [],
        watched: [],
      },
      profile:
        profileSeed?.fullName && profileSeed.fullName.length > 0
          ? {
              full_name: profileSeed.fullName,
            }
          : undefined,
      full_name:
        profileSeed?.fullName && profileSeed.fullName.length > 0
          ? profileSeed.fullName
          : undefined,
      nostr: {
        npub: identity.npub,
        pubkey: identity.pubkey,
        linked_at: nowIso,
      },
    });

    const created = await getDocument<NostrLinkedUserDocument>(
      "_users",
      `org.couchdb.user:${username}`,
    );

    if (!created) {
      throw createError({
        statusCode: 500,
        statusMessage: "Failed to load user after Nostr account creation",
      });
    }

    userDoc = created;
  } else {
    const nextPrefs = normalizeConferencePrefs(userDoc.conference_prefs);
    const nowIso = new Date().toISOString();

    userDoc = {
      ...userDoc,
      conference_prefs: nextPrefs,
      nostr: {
        npub: identity.npub,
        pubkey: identity.pubkey,
        linked_at: userDoc.nostr?.linked_at || nowIso,
      },
    };

    const updateResult = await putDocument("_users", userDoc);
    userDoc._rev = updateResult.rev;
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
