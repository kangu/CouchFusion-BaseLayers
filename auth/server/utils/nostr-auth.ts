import { createError } from "h3";
import { nip19 } from "nostr-tools";

export interface DecodedNostrIdentity {
  npub: string;
  pubkey: string;
}

const isHexPubkey = (value: string): boolean => /^[0-9a-f]{64}$/i.test(value);

export const normalizeNostrIdentity = (input: unknown): DecodedNostrIdentity => {
  if (typeof input !== "string") {
    throw createError({
      statusCode: 400,
      statusMessage: "Nostr identity is required",
    });
  }

  const value = input.trim();
  if (!value.length) {
    throw createError({
      statusCode: 400,
      statusMessage: "Nostr identity is empty",
    });
  }

  if (value.startsWith("npub1")) {
    const decoded = nip19.decode(value);

    if (decoded.type !== "npub" || typeof decoded.data !== "string") {
      throw createError({
        statusCode: 400,
        statusMessage: "Invalid npub value",
      });
    }

    return {
      npub: value,
      pubkey: decoded.data,
    };
  }

  if (isHexPubkey(value)) {
    return {
      npub: nip19.npubEncode(value.toLowerCase()),
      pubkey: value.toLowerCase(),
    };
  }

  throw createError({
    statusCode: 400,
    statusMessage: "Nostr identity must be npub or 64-char hex pubkey",
  });
};

export const sanitizeAuthUser = (doc: Record<string, any>) => {
  const {
    _id,
    _rev,
    password,
    password_scheme,
    derived_key,
    salt,
    pbkdf2_prf,
    iterations,
    ...safeUserData
  } = doc;

  return safeUserData;
};
