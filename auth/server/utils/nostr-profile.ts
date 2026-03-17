import { SimplePool } from "nostr-tools";
import { getNostrRelayValues } from "#auth/server/utils/nostr-config";

export interface NostrProfileSeed {
  fullName?: string;
  email?: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const asNonEmptyString = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const resolveProfileName = (metadata: Record<string, unknown>): string | undefined => {
  return (
    asNonEmptyString(metadata.name) ||
    asNonEmptyString(metadata.display_name) ||
    asNonEmptyString(metadata.displayName) ||
    asNonEmptyString(metadata.username)
  );
};

const resolveProfileEmail = (metadata: Record<string, unknown>): string | undefined => {
  const candidates = [
    metadata.email,
    metadata.contact_email,
    metadata.contactEmail,
    metadata.mail,
    metadata.nip05,
  ];

  for (const candidate of candidates) {
    const value = asNonEmptyString(candidate);
    if (!value) {
      continue;
    }

    const normalized = value.toLowerCase();
    if (EMAIL_PATTERN.test(normalized)) {
      return normalized;
    }
  }

  return undefined;
};

export const fetchNostrProfileSeed = async (
  pubkey: string,
): Promise<NostrProfileSeed | null> => {
  let relays: string[] = [];
  const pool = new SimplePool();

  try {
    const relayConfig = await getNostrRelayValues();
    relays = relayConfig.relays;

    const profileEvent = await pool.get(
      relays,
      {
        kinds: [0],
        authors: [pubkey],
        limit: 1,
      },
      {
        maxWait: 7_000,
      },
    );

    if (!profileEvent || typeof profileEvent.content !== "string") {
      return null;
    }

    let metadata: Record<string, unknown>;

    try {
      const parsed = JSON.parse(profileEvent.content);
      if (!parsed || typeof parsed !== "object") {
        return null;
      }
      metadata = parsed as Record<string, unknown>;
    } catch {
      return null;
    }

    const fullName = resolveProfileName(metadata);
    const email = resolveProfileEmail(metadata);

    if (!fullName && !email) {
      return null;
    }

    return {
      fullName,
      email,
    };
  } catch (error: any) {
    console.warn(
      `[Auth:NostrProfile] Failed to resolve kind-0 profile for pubkey ${pubkey.slice(0, 12)}...`,
      error?.message || error,
    );
    return null;
  } finally {
    if (relays.length) {
      pool.close(relays);
    }
    pool.destroy();
  }
};
