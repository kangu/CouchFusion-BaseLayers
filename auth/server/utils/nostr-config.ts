import { basename } from "node:path";
import { createError } from "h3";

export interface NostrConfigValues {
  section: string;
  senderNsec: string;
  relays: string[];
  dmMode: NostrDmMode;
}

export interface NostrRelayValues {
  section: string;
  relays: string[];
}

export type NostrDmMode = "nip17" | "nip04" | "dual";

const normalizeRelays = (rawRelays: string): string[] => {
  return rawRelays
    .split(/[\s,]+/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .filter((entry) => entry.startsWith("ws://") || entry.startsWith("wss://"));
};

const resolveConfigSectionName = (): string => {
  const runtimeConfig = useRuntimeConfig();

  if (
    typeof runtimeConfig.nostrConfigSection === "string" &&
    runtimeConfig.nostrConfigSection.trim().length > 0
  ) {
    return runtimeConfig.nostrConfigSection.trim();
  }

  const slugFromRuntime =
    typeof runtimeConfig.nostrConfigSlug === "string"
      ? runtimeConfig.nostrConfigSlug.trim()
      : "";
  const slug = slugFromRuntime || basename(process.cwd());

  return `cf_env_${slug}`;
};

const parseConfigResponse = (payload: unknown): Record<string, string> => {
  if (!payload || typeof payload !== "object") {
    return {};
  }

  const record = payload as Record<string, unknown>;
  const parsed: Record<string, string> = {};

  for (const [key, value] of Object.entries(record)) {
    if (typeof value === "string") {
      parsed[key] = value;
    }
  }

  return parsed;
};

const normalizeDmMode = (value: unknown): NostrDmMode => {
  if (typeof value !== "string") {
    return "nip17";
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === "nip17" || normalized === "nip04" || normalized === "dual") {
    return normalized;
  }

  throw createError({
    statusCode: 500,
    statusMessage: `Invalid nostr_dm_mode value "${value}". Allowed values: nip17, nip04, dual`,
  });
};

export const getNostrConfigValues = async (): Promise<NostrConfigValues> => {
  const runtimeConfig = useRuntimeConfig();
  const section = resolveConfigSectionName();

  if (
    typeof runtimeConfig.couchUrl !== "string" ||
    !runtimeConfig.couchUrl.trim().length
  ) {
    throw createError({
      statusCode: 500,
      statusMessage: "CouchDB URL runtime config is missing",
    });
  }

  if (
    typeof runtimeConfig.couchAdminAuth !== "string" ||
    !runtimeConfig.couchAdminAuth.trim().length
  ) {
    throw createError({
      statusCode: 500,
      statusMessage: "CouchDB admin auth runtime config is missing",
    });
  }

  const couchBase = runtimeConfig.couchUrl.replace(/\/$/, "");
  const configUrl = `${couchBase}/_node/_local/_config/${encodeURIComponent(section)}`;

  const response = await fetch(configUrl, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Basic ${runtimeConfig.couchAdminAuth}`,
    },
  });

  if (!response.ok) {
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to read CouchDB _config section ${section}`,
    });
  }

  const parsed = parseConfigResponse(await response.json());

  const senderNsec =
    parsed.nostr_sender_nsec ||
    parsed.nostrNsec ||
    (typeof runtimeConfig.nostrSenderNsec === "string"
      ? runtimeConfig.nostrSenderNsec
      : "");

  const rawRelays =
    parsed.nostr_relays ||
    parsed.nostr_relay_list ||
    parsed.nostrRelayList ||
    (typeof runtimeConfig.nostrRelayList === "string"
      ? runtimeConfig.nostrRelayList
      : "");

  const relays = normalizeRelays(rawRelays);
  const rawDmMode =
    parsed.nostr_dm_mode ||
    parsed.nostrDmMode ||
    parsed.nostr_mode ||
    (typeof runtimeConfig.nostrDmMode === "string" ? runtimeConfig.nostrDmMode : "");
  const dmMode = normalizeDmMode(rawDmMode);

  if (!senderNsec || !senderNsec.trim().length) {
    throw createError({
      statusCode: 500,
      statusMessage: `Missing nostr_sender_nsec in CouchDB _config section ${section}`,
    });
  }

  if (!relays.length) {
    throw createError({
      statusCode: 500,
      statusMessage: `Missing nostr_relays in CouchDB _config section ${section}`,
    });
  }

  return {
    section,
    senderNsec: senderNsec.trim(),
    relays,
    dmMode,
  };
};

export const getNostrRelayValues = async (): Promise<NostrRelayValues> => {
  const runtimeConfig = useRuntimeConfig();
  const section = resolveConfigSectionName();

  if (
    typeof runtimeConfig.couchUrl !== "string" ||
    !runtimeConfig.couchUrl.trim().length
  ) {
    throw createError({
      statusCode: 500,
      statusMessage: "CouchDB URL runtime config is missing",
    });
  }

  if (
    typeof runtimeConfig.couchAdminAuth !== "string" ||
    !runtimeConfig.couchAdminAuth.trim().length
  ) {
    throw createError({
      statusCode: 500,
      statusMessage: "CouchDB admin auth runtime config is missing",
    });
  }

  const couchBase = runtimeConfig.couchUrl.replace(/\/$/, "");
  const configUrl = `${couchBase}/_node/_local/_config/${encodeURIComponent(section)}`;

  const response = await fetch(configUrl, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Basic ${runtimeConfig.couchAdminAuth}`,
    },
  });

  if (!response.ok) {
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to read CouchDB _config section ${section}`,
    });
  }

  const parsed = parseConfigResponse(await response.json());
  const rawRelays =
    parsed.nostr_relays ||
    parsed.nostr_relay_list ||
    parsed.nostrRelayList ||
    (typeof runtimeConfig.nostrRelayList === "string"
      ? runtimeConfig.nostrRelayList
      : "");

  const relays = normalizeRelays(rawRelays);

  if (!relays.length) {
    throw createError({
      statusCode: 500,
      statusMessage: `Missing nostr_relays in CouchDB _config section ${section}`,
    });
  }

  return {
    section,
    relays,
  };
};
