import { createError } from "h3";
import { getView } from "#database/utils/couchdb";
import { finalizeEvent, getPublicKey, nip04, nip17, nip19, SimplePool } from "nostr-tools";
import { getNostrConfigValues } from "#auth/server/utils/nostr-config";
import type { ConferenceDocument } from "./conference-csv";

interface ConferenceWatcher {
  userId: string;
  username: string;
  npub: string;
}

interface NotifyResult {
  requested: boolean;
  eligible: number;
  sent: number;
  failed: number;
  failures: Array<{
    npub: string;
    reason: string;
  }>;
}

interface NotificationPreview {
  requested: boolean;
  eligible: number;
  watcherNpubs: string[];
  message: string;
  changeLines: string[];
}

const normalizeWatcherValue = (value: unknown): ConferenceWatcher | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const npub = typeof record.npub === "string" ? record.npub.trim() : "";

  if (!npub) {
    return null;
  }

  return {
    userId: typeof record.user_id === "string" ? record.user_id : "",
    username: typeof record.username === "string" ? record.username : "",
    npub,
  };
};

const resolveConferenceWatchers = async (
  conferenceId: string,
): Promise<ConferenceWatcher[]> => {
  console.log(`[Events:NostrNotify] Resolving watchers for conference ${conferenceId}`);
  const watchersResult = await getView("_users", "auth", "watchers_by_conference", {
    key: conferenceId,
  });

  if (!Array.isArray(watchersResult?.rows) || watchersResult.rows.length === 0) {
    console.log(
      `[Events:NostrNotify] No watcher rows found for conference ${conferenceId}`,
    );
    return [];
  }

  const map = new Map<string, ConferenceWatcher>();

  for (const row of watchersResult.rows) {
    const watcher = normalizeWatcherValue(row?.value);
    if (!watcher) {
      continue;
    }

    if (!map.has(watcher.npub)) {
      map.set(watcher.npub, watcher);
    }
  }

  return Array.from(map.values());
};

const decodeNsec = (nsec: string): Uint8Array => {
  const decoded = nip19.decode(nsec);
  if (decoded.type !== "nsec" || !(decoded.data instanceof Uint8Array)) {
    throw createError({
      statusCode: 500,
      statusMessage: "Invalid nostr sender nsec in CouchDB _config",
    });
  }

  return decoded.data;
};

const decodeNpubToPubkey = (npub: string): string => {
  const decoded = nip19.decode(npub);
  if (decoded.type !== "npub" || typeof decoded.data !== "string") {
    throw createError({
      statusCode: 400,
      statusMessage: `Invalid npub recipient: ${npub}`,
    });
  }

  return decoded.data;
};

const summarizeConferenceChanges = (
  previousConference: ConferenceDocument,
  nextConference: ConferenceDocument,
): string[] => {
  const OMITTED_PATHS = new Set([
    "_id",
    "_rev",
    "type",
    "createdAt",
    "updatedAt",
  ]);

  const isPlainObject = (value: unknown): value is Record<string, unknown> => {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  };

  const flatten = (
    value: unknown,
    prefix = "",
  ): Array<{ path: string; value: unknown }> => {
    if (!isPlainObject(value)) {
      return prefix.length ? [{ path: prefix, value }] : [];
    }

    const keys = Object.keys(value).sort((left, right) => left.localeCompare(right));
    const entries: Array<{ path: string; value: unknown }> = [];

    for (const key of keys) {
      const nextPath = prefix.length ? `${prefix}.${key}` : key;
      const nextValue = value[key];

      if (isPlainObject(nextValue)) {
        entries.push(...flatten(nextValue, nextPath));
        continue;
      }

      entries.push({ path: nextPath, value: nextValue });
    }

    return entries;
  };

  const toMessageValue = (value: unknown): string => {
    if (typeof value === "undefined") return "(missing)";
    if (value === null) return "(empty)";
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed.length) return "(empty)";
      return trimmed.length > 300 ? `${trimmed.slice(0, 297)}...` : trimmed;
    }
    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }

    try {
      const serialized = JSON.stringify(value);
      if (!serialized) return "(empty)";
      return serialized.length > 300 ? `${serialized.slice(0, 297)}...` : serialized;
    } catch {
      return String(value);
    }
  };

  const previousFlat = new Map(
    flatten(previousConference).map((entry) => [entry.path, entry.value]),
  );
  const nextFlat = new Map(
    flatten(nextConference).map((entry) => [entry.path, entry.value]),
  );

  const allPaths = Array.from(
    new Set([...previousFlat.keys(), ...nextFlat.keys()]),
  ).sort((left, right) => left.localeCompare(right));

  const lines: string[] = [];

  for (const path of allPaths) {
    if (OMITTED_PATHS.has(path)) {
      continue;
    }

    const previousValue = previousFlat.get(path);
    const nextValue = nextFlat.get(path);

    if (JSON.stringify(previousValue) === JSON.stringify(nextValue)) {
      continue;
    }

    lines.push(
      `- ${path}: ${toMessageValue(previousValue)} -> ${toMessageValue(nextValue)}`,
    );
  }

  return lines;
};

const buildConferenceNostrMessage = (
  conference: ConferenceDocument,
  changeLines: string[],
  customMessage?: string,
): string => {
  const baseLines = [
    `Conference update: ${conference.name}`,
    `Conference ID: ${conference._id}`,
    conference.startDateIso ? `Start date: ${conference.startDateIso}` : "",
    conference.location ? `Location: ${conference.location}` : "",
    conference.status ? `Status: ${conference.status}` : "",
  ].filter((line) => line.length > 0);

  const changeSection = changeLines.length
    ? ["", "Changes:", ...changeLines]
    : ["", "Changes:", "- metadata updated"];

  const customSection =
    typeof customMessage === "string" && customMessage.trim().length > 0
      ? ["", `Admin note: ${customMessage.trim()}`]
      : [];

  return [...baseLines, ...changeSection, ...customSection].join("\n");
};

const buildConferenceNotificationPreview = async (
  previousConference: ConferenceDocument,
  nextConference: ConferenceDocument,
  options: {
    customMessage?: string;
  } = {},
): Promise<{
  watchers: ConferenceWatcher[];
  message: string;
  changeLines: string[];
}> => {
  const watchers = await resolveConferenceWatchers(nextConference._id);
  const changeLines = summarizeConferenceChanges(previousConference, nextConference);
  const message = buildConferenceNostrMessage(
    nextConference,
    changeLines,
    options.customMessage,
  );

  return {
    watchers,
    message,
    changeLines,
  };
};

export const previewConferenceWatchersNostrMessage = async (
  previousConference: ConferenceDocument,
  nextConference: ConferenceDocument,
  options: {
    customMessage?: string;
  } = {},
): Promise<NotificationPreview> => {
  const prepared = await buildConferenceNotificationPreview(
    previousConference,
    nextConference,
    options,
  );

  return {
    requested: true,
    eligible: prepared.watchers.length,
    watcherNpubs: prepared.watchers.map((watcher) => watcher.npub),
    message: prepared.message,
    changeLines: prepared.changeLines,
  };
};

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  return await new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Nostr publish timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
};

const publishEventToRelays = async (
  relays: string[],
  event: Parameters<SimplePool["publish"]>[1],
  contextLabel: string,
): Promise<void> => {
  const pool = new SimplePool();

  try {
    const publishPromises = pool.publish(relays, event, {
      maxWait: 8_000,
    });

    if (!publishPromises.length) {
      throw new Error("No relay publish promises created");
    }

    const settled = await Promise.allSettled(
      relays.map((relay, index) => {
        const publishPromise = publishPromises[index];

        if (!publishPromise) {
          return Promise.reject(
            new Error(`Missing publish promise for relay ${relay}`),
          );
        }

        return withTimeout(publishPromise, 10_000);
      }),
    );

    let acknowledgedCount = 0;

    settled.forEach((result, index) => {
      const relay = relays[index];
      if (result.status === "fulfilled") {
        acknowledgedCount += 1;
        console.log(
          `[Events:NostrNotify] ${contextLabel} relay ack: ${relay} (${String(result.value)})`,
        );
        return;
      }

      console.error(
        `[Events:NostrNotify] ${contextLabel} relay failure: ${relay} (${result.reason?.message || String(result.reason)})`,
      );
    });

    if (acknowledgedCount === 0) {
      throw new Error(`${contextLabel} failed on all relays`);
    }
  } finally {
    pool.close(relays);
    pool.destroy();
  }
};

const dispatchNip17Message = async (
  relays: string[],
  senderSecretKey: Uint8Array,
  recipientPubkey: string,
  message: string,
): Promise<void> => {
  console.log(
    `[Events:NostrNotify] Publishing NIP-17 event for recipient pubkey ${recipientPubkey.slice(0, 12)}... to ${relays.length} relay(s)`,
  );
  const wrappedEvent = nip17.wrapEvent(
    senderSecretKey,
    {
      publicKey: recipientPubkey,
    },
    message,
  );

  await publishEventToRelays(
    relays,
    wrappedEvent,
    `NIP-17 recipient ${recipientPubkey.slice(0, 12)}...`,
  );
};

const dispatchNip04Message = async (
  relays: string[],
  senderSecretKey: Uint8Array,
  recipientPubkey: string,
  message: string,
): Promise<void> => {
  console.log(
    `[Events:NostrNotify] Publishing NIP-04 event for recipient pubkey ${recipientPubkey.slice(0, 12)}... to ${relays.length} relay(s)`,
  );

  const encryptedContent = nip04.encrypt(senderSecretKey, recipientPubkey, message);
  const signedEvent = finalizeEvent(
    {
      kind: 4,
      created_at: Math.floor(Date.now() / 1_000),
      tags: [["p", recipientPubkey]],
      content: encryptedContent,
    },
    senderSecretKey,
  );

  await publishEventToRelays(
    relays,
    signedEvent,
    `NIP-04 recipient ${recipientPubkey.slice(0, 12)}...`,
  );
};

export const notifyConferenceWatchersViaNostr = async (
  previousConference: ConferenceDocument,
  nextConference: ConferenceDocument,
  options: {
    customMessage?: string;
  } = {},
): Promise<NotifyResult> => {
  console.log(
    `[Events:NostrNotify] Notification requested for conference ${nextConference._id} (${nextConference.name})`,
  );

  const prepared = await buildConferenceNotificationPreview(
    previousConference,
    nextConference,
    options,
  );
  const watchers = prepared.watchers;

  if (!watchers.length) {
    console.log(
      `[Events:NostrNotify] No eligible watchers for conference ${nextConference._id}; skipping publish`,
    );
    return {
      requested: true,
      eligible: 0,
      sent: 0,
      failed: 0,
      failures: [],
    };
  }

  const nostrConfig = await getNostrConfigValues();
  const senderSecretKey = decodeNsec(nostrConfig.senderNsec);
  const senderPubkey = getPublicKey(senderSecretKey);

  console.log(
    `[Events:NostrNotify] Using config section ${nostrConfig.section} with relays: ${nostrConfig.relays.join(", ")}`,
  );
  console.log(
    `[Events:NostrNotify] DM mode=${nostrConfig.dmMode}, sender pubkey=${senderPubkey.slice(0, 12)}...`,
  );
  console.log(
    `[Events:NostrNotify] Watchers (${watchers.length}): ${watchers
      .map((watcher) => watcher.npub)
      .join(", ")}`,
  );

  const message = prepared.message;

  console.log("[Events:NostrNotify] Message payload to publish:");
  console.log(message);

  let sent = 0;
  const failures: NotifyResult["failures"] = [];

  for (const watcher of watchers) {
    try {
      console.log(
        `[Events:NostrNotify] Sending to watcher ${watcher.username || "(unknown-user)"} (${watcher.npub})`,
      );
      const recipientPubkey = decodeNpubToPubkey(watcher.npub);
      const modeOutcomes: string[] = [];

      if (nostrConfig.dmMode === "nip17" || nostrConfig.dmMode === "dual") {
        try {
          await dispatchNip17Message(
            nostrConfig.relays,
            senderSecretKey,
            recipientPubkey,
            message,
          );
          modeOutcomes.push("nip17:ok");
        } catch (error: any) {
          modeOutcomes.push(`nip17:fail(${error?.message || "unknown"})`);
          if (nostrConfig.dmMode === "nip17") {
            throw error;
          }
        }
      }

      if (nostrConfig.dmMode === "nip04" || nostrConfig.dmMode === "dual") {
        try {
          await dispatchNip04Message(
            nostrConfig.relays,
            senderSecretKey,
            recipientPubkey,
            message,
          );
          modeOutcomes.push("nip04:ok");
        } catch (error: any) {
          modeOutcomes.push(`nip04:fail(${error?.message || "unknown"})`);
          if (nostrConfig.dmMode === "nip04") {
            throw error;
          }
        }
      }

      if (!modeOutcomes.some((entry) => entry.endsWith(":ok"))) {
        throw new Error(`No DM mode succeeded: ${modeOutcomes.join(", ")}`);
      }

      sent += 1;
      console.log(
        `[Events:NostrNotify] Send succeeded for ${watcher.npub} (${modeOutcomes.join(", ")})`,
      );
    } catch (error: any) {
      console.error(
        `[Events:NostrNotify] Send failed for ${watcher.npub}:`,
        error?.message || error,
      );
      failures.push({
        npub: watcher.npub,
        reason: error?.message || "Failed to dispatch Nostr DM",
      });
    }
  }

  console.log(
    `[Events:NostrNotify] Completed publish for conference ${nextConference._id}: sent=${sent}, failed=${failures.length}, eligible=${watchers.length}`,
  );

  return {
    requested: true,
    eligible: watchers.length,
    sent,
    failed: failures.length,
    failures,
  };
};
